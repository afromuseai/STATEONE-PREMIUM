/**
 * STAGEONE Execution Bus — Central Orchestration Engine
 *
 * ExecutionBus is the single coordination layer for all AI module executions.
 * It does NOT own any UI, SSE, or persistence logic — those remain inside each
 * module's page and controller. The bus controls ONLY:
 *
 *   1. Routing — which controller handles a command
 *   2. Phase sequencing — IDLE → ROUTING → POPULATING → CONFIRMATION_WAIT
 *                         → GENERATING → COMPLETED (or ERROR)
 *   3. Confirmation gate — nothing generates before approve() is called
 *                          (auto-fires when payload.autoGenerate = true)
 *   4. Bus-level events — execution:* emitted at each phase boundary
 *
 * Usage:
 *   import { bus } from '@/lib/execution-bus'
 *
 *   // Full run (Copilot or programmatic):
 *   bus.execute({ module: 'website', action: 'run', payload: { idea, autoGenerate: true } })
 *
 *   // Populate only, then wait for the user to click Generate:
 *   const record = await bus.execute({ module: 'website', action: 'populate', payload: { idea } })
 *   // later, when Generate is clicked:
 *   bus.approve(record.executionId)
 *
 *   // Generate immediately (inputs already populated):
 *   bus.execute({ module: 'website', action: 'generate' })
 */

import type { ExecutionCommand, ExecutionModuleId, ExecutionRecord } from './types';
import { emitBusEvent } from './events';
import {
  createExecution,
  transitionPhase,
  failExecution,
  cancelExecution,
  getExecution,
  getActiveExecution,
  getAllExecutions,
} from './lifecycle-manager';
import { resolveExecutionModule, parseModuleId } from './module-registry';

// ── Confirmation gate ─────────────────────────────────────────────────────────

/** Map of executionId → resolve fn for the confirmation Promise. */
const _confirmationGates = new Map<string, (approved: boolean) => void>();

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeTransition(executionId: string, phase: Parameters<typeof transitionPhase>[1]) {
  try {
    transitionPhase(executionId, phase);
  } catch (err) {
    console.warn('[ExecutionBus] phase transition skipped:', err);
  }
}

// ── ExecutionBus class ────────────────────────────────────────────────────────

class ExecutionBus {
  /**
   * Execute a command against a module.
   *
   * Returns the ExecutionRecord for tracking. The Promise resolves once the
   * execution reaches a terminal state (COMPLETED, ERROR, or cancelled).
   *
   * Does NOT throw on module-not-ready — returns an error record instead so
   * callers can react gracefully when the target page is not mounted yet.
   *
   * Phase flow by action:
   *   populate → ROUTING → POPULATING → CONFIRMATION_WAIT  (terminal, waits for approve())
   *   generate → ROUTING → GENERATING → COMPLETED
   *   run      → ROUTING → POPULATING → (auto-approve if autoGenerate) → GENERATING → COMPLETED
   */
  async execute(command: ExecutionCommand): Promise<ExecutionRecord> {
    const payload = command.payload ?? {};
    const moduleId: ExecutionModuleId = command.module;

    // 1. Create record
    const record = createExecution(moduleId, payload);
    const { executionId } = record;

    console.log(`[ExecutionBus] execute | id=${executionId} | module=${moduleId} | action=${command.action} | autoGenerate=${payload.autoGenerate ?? false}`);

    try {
      // 2. ROUTING
      safeTransition(executionId, 'ROUTING');
      emitBusEvent('execution:routing', executionId, moduleId, { action: command.action });

      const mod = resolveExecutionModule(moduleId);

      // ── Generate-only path ────────────────────────────────────────────────
      if (command.action === 'generate') {
        if (!mod) {
          return this._fail(executionId, moduleId, `Module '${moduleId}' not registered — is the page mounted?`);
        }
        return await this._runGenerate(executionId, moduleId, mod);
      }

      // ── Populate or Run paths ─────────────────────────────────────────────
      if (command.action === 'populate' || command.action === 'run') {
        // Navigate first (best-effort: if mod not ready, module's bridge will handle
        // navigation via the controller's navigate() once mounted).
        if (mod) {
          await mod.navigate();
        } else {
          // Module not mounted — we cannot populate. Log and return an idle record.
          // The Copilot's existing navigate + intent mechanism handles pre-mount flows.
          console.warn(`[ExecutionBus] module '${moduleId}' not registered at execute time; navigation delegated to existing flow.`);
          // Terminate this bus execution as a no-op (the legacy flow will take over).
          cancelExecution(executionId);
          emitBusEvent('execution:cancelled', executionId, moduleId, { reason: 'module-not-mounted' });
          return getExecution(executionId)!;
        }

        // POPULATING
        safeTransition(executionId, 'POPULATING');
        emitBusEvent('execution:populate_started', executionId, moduleId, { idea: payload.idea });

        await mod.populate(payload);

        emitBusEvent('execution:populate_complete', executionId, moduleId);

        if (command.action === 'populate') {
          // Park at CONFIRMATION_WAIT — caller must call bus.approve(executionId) to generate.
          safeTransition(executionId, 'CONFIRMATION_WAIT');
          emitBusEvent('execution:confirmation_required', executionId, moduleId, { executionId });
          await this._waitForConfirmation(executionId, moduleId);
          // After approval, fall through to generate.
          return await this._runGenerate(executionId, moduleId, mod);
        }

        // action === 'run'
        if (payload.autoGenerate) {
          // Auto-approve immediately — no CONFIRMATION_WAIT for programmatic flows.
          emitBusEvent('execution:confirmation_approved', executionId, moduleId, { auto: true });
        } else {
          // Populate-then-confirm: park and wait for the user to click Generate (or approve()).
          safeTransition(executionId, 'CONFIRMATION_WAIT');
          emitBusEvent('execution:confirmation_required', executionId, moduleId, { executionId });
          await this._waitForConfirmation(executionId, moduleId);
        }

        return await this._runGenerate(executionId, moduleId, mod);
      }

      // Unknown action
      return this._fail(executionId, moduleId, `Unknown action: ${command.action}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this._fail(executionId, moduleId, msg);
    }
  }

  /**
   * Execute a `run` command using a raw module-name string (from Copilot {{WORKSPACE|run|...}} tags).
   * Parses the module name and delegates to execute().
   *
   * @param rawModule  Raw module string from the tag payload (e.g. "website", "automation-builder")
   * @param idea       Business idea text
   * @param autoGenerate  Whether to skip CONFIRMATION_WAIT (default true for Copilot)
   */
  async executeRun(rawModule: string, idea: string, autoGenerate = true): Promise<ExecutionRecord | null> {
    const moduleId = parseModuleId(rawModule);
    if (!moduleId) {
      console.warn(`[ExecutionBus] executeRun: unrecognised module "${rawModule}"`);
      return null;
    }
    return this.execute({ module: moduleId, action: 'run', payload: { idea, autoGenerate } });
  }

  /**
   * Approve a parked CONFIRMATION_WAIT execution.
   * This is how a Generate button (or any UI) signals that the user confirmed.
   */
  approve(executionId: string): void {
    const gate = _confirmationGates.get(executionId);
    if (gate) {
      gate(true);
    } else {
      console.warn(`[ExecutionBus] approve(): no pending confirmation for executionId=${executionId}`);
    }
  }

  /**
   * Cancel a pending execution.
   * If it's waiting at CONFIRMATION_WAIT, the gate is resolved as rejected.
   */
  cancel(executionId: string): void {
    const gate = _confirmationGates.get(executionId);
    if (gate) gate(false);

    try {
      const record = cancelExecution(executionId);
      const moduleId = record.moduleId;
      emitBusEvent('execution:cancelled', executionId, moduleId, { manual: true });
    } catch { /* already terminal */ }
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** The most recently started active execution, or null. */
  getActiveExecution(): ExecutionRecord | null {
    return getActiveExecution();
  }

  /** Get a specific execution record by ID. */
  getExecution(executionId: string): ExecutionRecord | undefined {
    return getExecution(executionId);
  }

  /** All recorded executions, newest-first. */
  getAllExecutions(): ExecutionRecord[] {
    return getAllExecutions();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _runGenerate(
    executionId: string,
    moduleId: ExecutionModuleId,
    mod: NonNullable<ReturnType<typeof resolveExecutionModule>>,
  ): Promise<ExecutionRecord> {
    safeTransition(executionId, 'GENERATING');
    emitBusEvent('execution:generate_started', executionId, moduleId);

    await mod.generate();

    safeTransition(executionId, 'COMPLETED');
    emitBusEvent('execution:generate_complete', executionId, moduleId);
    emitBusEvent('execution:completed', executionId, moduleId);

    return getExecution(executionId)!;
  }

  private async _waitForConfirmation(executionId: string, moduleId: ExecutionModuleId): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      _confirmationGates.set(executionId, (approved) => {
        _confirmationGates.delete(executionId);
        if (approved) {
          emitBusEvent('execution:confirmation_approved', executionId, moduleId, { auto: false });
          resolve();
        } else {
          reject(new Error('Execution cancelled at confirmation gate'));
        }
      });
    });
  }

  private _fail(executionId: string, moduleId: ExecutionModuleId, error: string): ExecutionRecord {
    console.error(`[ExecutionBus] execution failed | id=${executionId} | error=${error}`);
    const record = failExecution(executionId, error);
    emitBusEvent('execution:error', executionId, moduleId, { error });
    return record;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The global ExecutionBus singleton.
 *
 * Import this everywhere — do NOT instantiate ExecutionBus directly.
 *
 *   import { bus } from '@/lib/execution-bus'
 */
export const bus = new ExecutionBus();
export { ExecutionBus };
