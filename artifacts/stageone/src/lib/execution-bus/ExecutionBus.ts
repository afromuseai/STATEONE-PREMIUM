/**
 * STAGEONE Execution Bus — Central Orchestration Engine (Phase 6.5)
 *
 * Navigation-aware and resumable. When execute() is called for a module whose
 * page is not yet mounted, the bus:
 *
 *   1. Navigates to the module's route (via the injected navigator function).
 *   2. Parks in WAITING_FOR_CONTROLLER.
 *   3. Listens for registerController() to fire (via the registry hook).
 *   4. Resumes automatically — populate → confirm → generate — without any
 *      user interaction required.
 *   5. Times out after 60 s if the controller never registers.
 *
 * Call `bus.setNavigator(navigate)` once from inside the WouterRouter tree
 * (see ExecutionBusNavigatorSetup in App.tsx). Without a navigator the bus
 * logs a warning and waits; it will still resume if the page mounts another way.
 *
 * Usage:
 *   import { bus } from '@/lib/execution-bus'
 *   bus.execute({ module: 'website', action: 'run', payload: { idea, autoGenerate: true } })
 *   bus.approve(executionId)    // confirm gate
 *   bus.cancel(executionId)
 */

import type { ExecutionAction, ExecutionCommand, ExecutionModuleId, ExecutionPayload, ExecutionRecord } from './types';
import { emitBusEvent } from './events';
import { tracer } from '@/lib/execution-tracer';
import {
  createExecution,
  transitionPhase,
  failExecution,
  cancelExecution,
  getExecution,
  getActiveExecution,
  getAllExecutions,
} from './lifecycle-manager';
import { resolveExecutionModule, MODULE_ROUTES, type ExecutionModule } from './module-registry';
import { subscribeControllerRegistration } from '@/lib/module-architecture/registry';

// ── Pending execution store ───────────────────────────────────────────────────

interface PendingExecution {
  executionId: string;
  moduleId: ExecutionModuleId;
  payload: ExecutionPayload;
  action: ExecutionAction;
  /** Called with the resolved ExecutionModule when the controller registers. */
  resume: (mod: ExecutionModule) => void;
  /** Called with an Error if the 60 s timeout fires. */
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const _pendingExecutions = new Map<string, PendingExecution>();

// ── Confirmation gate store ───────────────────────────────────────────────────

const _confirmationGates = new Map<string, (approved: boolean) => void>();

// ── Navigator ─────────────────────────────────────────────────────────────────

let _navigator: ((path: string) => void) | null = null;

// ── Helper ────────────────────────────────────────────────────────────────────

function safeTransition(executionId: string, phase: Parameters<typeof transitionPhase>[1]) {
  try {
    transitionPhase(executionId, phase);
  } catch (err) {
    console.warn('[ExecutionBus] phase transition skipped:', err);
  }
}

// ── ExecutionBus ──────────────────────────────────────────────────────────────

class ExecutionBus {
  constructor() {
    // Subscribe to controller registration events from the module-architecture
    // registry. When a page mounts and calls registerController(), this hook
    // fires synchronously — which resumes any pending execution for that module.
    subscribeControllerRegistration((registeredId) => {
      for (const [execId, pending] of _pendingExecutions) {
        if (pending.moduleId === registeredId) {
          _pendingExecutions.delete(execId);
          clearTimeout(pending.timeout);

          const mod = resolveExecutionModule(registeredId);
          if (mod) {
            pending.resume(mod);
          } else {
            pending.reject(
              new Error(`[ExecutionBus] Controller registered for '${registeredId}' but resolveExecutionModule returned null`)
            );
          }
          // Only resume one pending execution per registration event.
          // Multiple pending executions for the same module are unlikely but
          // possible; subsequent ones will resume on the next registration tick.
          break;
        }
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Inject a navigation function so the bus can drive routing when the target
   * page is not yet mounted. Call this once from inside the WouterRouter tree:
   *
   *   bus.setNavigator(navigate)  // navigate = second element of useLocation()
   */
  setNavigator(navigate: (path: string) => void): void {
    _navigator = navigate;
  }

  /**
   * Execute a command against a module.
   *
   * If the module controller is not registered yet (page not mounted), the bus:
   *   - Navigates to the module's route
   *   - Parks in WAITING_FOR_CONTROLLER
   *   - Resumes automatically when registerController() fires
   *   - Times out after 60 s with an error record
   *
   * Returns the ExecutionRecord. Promise resolves when the execution reaches a
   * terminal state (COMPLETED, ERROR, or cancelled).
   */
  async execute(command: ExecutionCommand): Promise<ExecutionRecord> {
    const payload = command.payload ?? {};
    const moduleId: ExecutionModuleId = command.module;

    const record = createExecution(moduleId, payload);
    const { executionId } = record;

    console.log(
      `[ExecutionBus] execute | id=${executionId} | module=${moduleId}` +
      ` | action=${command.action} | autoGenerate=${payload.autoGenerate ?? false}`
    );

    // ── Execution trace — Stage 3 ────────────────────────────────────────────
    const traceId = (payload as Record<string, unknown>)._traceId as string | undefined;
    if (traceId) {
      tracer.logStage(traceId, 3, "ExecutionBus entered", {
        functionName: "ExecutionBus.execute",
        success: true,
        data: { busExecutionId: executionId, module: moduleId, action: command.action },
      });
    }

    try {
      // ── ROUTING ─────────────────────────────────────────────────────────────
      safeTransition(executionId, 'ROUTING');
      emitBusEvent('execution:routing', executionId, moduleId, { action: command.action });

      let mod = resolveExecutionModule(moduleId);

      // ── Execution trace — Stage 4 ──────────────────────────────────────────
      if (traceId) {
        tracer.logStage(traceId, 4, "Controller resolved", {
          functionName: "resolveExecutionModule",
          success: !!mod,
          reason: mod ? undefined : `Controller not mounted for '${moduleId}' — navigating and waiting`,
          data: { immediate: !!mod },
        });
      }

      // ── Wait for controller if not mounted ───────────────────────────────────
      if (!mod) {
        const route = MODULE_ROUTES[moduleId];
        if (_navigator && route) {
          console.log(`[ExecutionBus] navigating to ${route} for module '${moduleId}'`);
          _navigator(route);
        } else {
          console.warn(
            `[ExecutionBus] No navigator set or no route for '${moduleId}'. ` +
            `Call bus.setNavigator(navigate) from inside WouterRouter.`
          );
        }

        safeTransition(executionId, 'WAITING_FOR_CONTROLLER');
        emitBusEvent('execution:waiting_for_controller', executionId, moduleId, { route });

        // Park here until registerController() fires or timeout expires.
        mod = await this._waitForController(executionId, moduleId, payload, command.action);

        // Controller is now available — resume.
        emitBusEvent('execution:resumed', executionId, moduleId);
        console.log(`[ExecutionBus] resumed | id=${executionId} | module=${moduleId}`);
      }

      // ── Run the requested action ─────────────────────────────────────────────
      return await this._runAction(executionId, moduleId, mod, command.action, payload, traceId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (traceId) {
        tracer.endExecution(traceId, false, msg);
      }
      return this._fail(executionId, moduleId, msg);
    }
  }

  /**
   * Convenience method for the Copilot `{{WORKSPACE|run|<module>|<idea>}}` tag.
   * Parses the module name and delegates to execute().
   *
   * autoGenerate defaults to false: Marcus is a workspace operator, not a second
   * generation pipeline. Every run must pause at the confirmation gate and wait
   * for explicit user approval before the standalone module's generate() fires —
   * mirroring the confirmation flow used by the generate_* WORKSPACE commands.
   */
  async executeRun(rawModule: string, idea: string, autoGenerate = false, traceId?: string): Promise<ExecutionRecord | null> {
    const { parseModuleId } = await import('./module-registry');
    const moduleId = parseModuleId(rawModule);
    if (!moduleId) {
      console.warn(`[ExecutionBus] executeRun: unrecognised module "${rawModule}"`);
      return null;
    }
    return this.execute({ module: moduleId, action: 'run', payload: { idea, autoGenerate, _traceId: traceId } });
  }

  /**
   * Approve a parked CONFIRMATION_WAIT execution.
   * This is how a Generate button (or any UI trigger) signals user confirmation.
   */
  approve(executionId: string): void {
    const gate = _confirmationGates.get(executionId);
    if (gate) {
      gate(true);
    } else {
      console.warn(`[ExecutionBus] approve(): no pending confirmation for id=${executionId}`);
    }
  }

  /**
   * Cancel a pending or waiting execution.
   * Clears both the confirmation gate and the pending controller queue.
   */
  cancel(executionId: string): void {
    // Cancel confirmation gate if parked there
    const gate = _confirmationGates.get(executionId);
    if (gate) { _confirmationGates.delete(executionId); gate(false); }

    // Cancel controller wait if parked there
    const pending = _pendingExecutions.get(executionId);
    if (pending) {
      _pendingExecutions.delete(executionId);
      clearTimeout(pending.timeout);
      pending.reject(new Error('Execution cancelled by caller'));
    }

    try {
      const cancelled = cancelExecution(executionId);
      emitBusEvent('execution:cancelled', executionId, cancelled.moduleId, { manual: true });
    } catch { /* already terminal */ }
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  getActiveExecution(): ExecutionRecord | null { return getActiveExecution(); }
  getExecution(id: string): ExecutionRecord | undefined { return getExecution(id); }
  getAllExecutions(): ExecutionRecord[] { return getAllExecutions(); }

  // ── Internal ────────────────────────────────────────────────────────────────

  /**
   * Park execution in WAITING_FOR_CONTROLLER. Returns a Promise that resolves
   * with the ExecutionModule when registerController() fires for this module,
   * or rejects after 60 s.
   */
  private _waitForController(
    executionId: string,
    moduleId: ExecutionModuleId,
    payload: ExecutionPayload,
    action: ExecutionAction,
  ): Promise<ExecutionModule> {
    return new Promise<ExecutionModule>((resolve, reject) => {
      const timeout = setTimeout(() => {
        _pendingExecutions.delete(executionId);
        reject(
          new Error(
            `[ExecutionBus] Controller registration timeout (60s) for module '${moduleId}' ` +
            `(executionId=${executionId}). Is the target page reachable?`
          )
        );
      }, 60_000);

      _pendingExecutions.set(executionId, {
        executionId,
        moduleId,
        payload,
        action,
        resume: resolve,
        reject,
        timeout,
      });

      // TOCTOU guard: registerController() fires synchronously inside React's
      // useEffect commit phase. If the component remounted between the null check
      // in execute() and _pendingExecutions.set() above, the subscription callback
      // already fired against an empty map and the resume was silently dropped.
      // Re-check now that the entry is registered — if the module is already
      // available, resolve immediately rather than waiting for an event that
      // will never fire again.
      const immediate = resolveExecutionModule(moduleId);
      if (immediate) {
        _pendingExecutions.delete(executionId);
        clearTimeout(timeout);
        resolve(immediate);
      }
    });
  }

  /**
   * Run populate → confirm → generate (or just generate) depending on action.
   * Called once the ExecutionModule is confirmed available.
   */
  private async _runAction(
    executionId: string,
    moduleId: ExecutionModuleId,
    mod: ExecutionModule,
    action: ExecutionAction,
    payload: ExecutionPayload,
    traceId?: string,
  ): Promise<ExecutionRecord> {
    // ── generate-only path ───────────────────────────────────────────────────
    if (action === 'generate') {
      return await this._runGenerate(executionId, moduleId, mod, traceId, payload);
    }

    // ── populate / run path ──────────────────────────────────────────────────
    if (action === 'populate' || action === 'run') {
      // Navigate (idempotent — controller.navigate() uses setLocation which no-ops if already there)
      await mod.navigate();

      // POPULATING
      safeTransition(executionId, 'POPULATING');
      emitBusEvent('execution:populate_started', executionId, moduleId, { idea: payload.idea });

      // ── Execution trace — Stage 5 ──────────────────────────────────────────
      if (traceId) {
        tracer.logStage(traceId, 5, "Bridge called", {
          functionName: "ExecutionModule.populate",
          success: true,
          data: { module: moduleId },
        });
      }

      await mod.populate(payload);
      emitBusEvent('execution:populate_complete', executionId, moduleId);

      // ── Execution trace — Stage 6 ──────────────────────────────────────────
      if (traceId) {
        tracer.logStage(traceId, 6, "Populate", {
          functionName: "ExecutionModule.populate",
          success: true,
          data: { module: moduleId },
        });
      }

      // Confirmation gate
      if (action === 'populate') {
        // Populate-only: park unconditionally and wait for approve()
        safeTransition(executionId, 'CONFIRMATION_WAIT');
        emitBusEvent('execution:confirmation_required', executionId, moduleId, { executionId });
        await this._waitForConfirmationTraced(executionId, moduleId, traceId);
        return await this._runGenerate(executionId, moduleId, mod, traceId, payload);
      }

      // action === 'run'
      if (payload.autoGenerate) {
        // Skip CONFIRMATION_WAIT for programmatic flows
        emitBusEvent('execution:confirmation_approved', executionId, moduleId, { auto: true });
        // ── Execution trace — Stage 7 ────────────────────────────────────────
        if (traceId) {
          tracer.logStage(traceId, 7, "Confirmation", {
            functionName: "ExecutionBus._runAction",
            success: true,
            reason: "auto-approved (autoGenerate=true)",
          });
        }
      } else {
        // Park and wait for user to click Generate (or call approve())
        safeTransition(executionId, 'CONFIRMATION_WAIT');
        emitBusEvent('execution:confirmation_required', executionId, moduleId, { executionId });
        await this._waitForConfirmationTraced(executionId, moduleId, traceId);
      }

      return await this._runGenerate(executionId, moduleId, mod, traceId, payload);
    }

    return this._fail(executionId, moduleId, `Unknown action: ${action}`);
  }

  /**
   * Wraps _waitForConfirmation with Stage 7 "Confirmation" tracing.
   * Logs success on approval, failure (with reason) on cancellation, then rethrows.
   */
  private async _waitForConfirmationTraced(
    executionId: string,
    moduleId: ExecutionModuleId,
    traceId?: string,
  ): Promise<void> {
    try {
      await this._waitForConfirmation(executionId, moduleId);
      if (traceId) {
        tracer.logStage(traceId, 7, "Confirmation", {
          functionName: "ExecutionBus._waitForConfirmation",
          success: true,
        });
      }
    } catch (err) {
      if (traceId) {
        const reason = err instanceof Error ? err.message : String(err);
        tracer.logStage(traceId, 7, "Confirmation", {
          functionName: "ExecutionBus._waitForConfirmation",
          success: false,
          reason,
        });
        tracer.endExecution(traceId, false, reason);
      }
      throw err;
    }
  }

  private async _runGenerate(
    executionId: string,
    moduleId: ExecutionModuleId,
    mod: ExecutionModule,
    traceId?: string,
    payload?: ExecutionPayload,
  ): Promise<ExecutionRecord> {
    safeTransition(executionId, 'GENERATING');
    emitBusEvent('execution:generate_started', executionId, moduleId);

    // ── Execution trace — Stage 8 ────────────────────────────────────────────
    if (traceId) {
      tracer.logStage(traceId, 8, "Generate started", {
        functionName: "ExecutionModule.generate",
        success: true,
        data: { module: moduleId },
      });
    }

    try {
      await mod.generate(payload);
    } catch (err) {
      if (traceId) {
        const reason = err instanceof Error ? err.message : String(err);
        tracer.endExecution(traceId, false, reason);
      }
      throw err;
    }

    safeTransition(executionId, 'COMPLETED');
    emitBusEvent('execution:generate_complete', executionId, moduleId);
    emitBusEvent('execution:completed', executionId, moduleId);

    // Safety net: mod.generate() (via the page's bridge) should have already
    // logged Stages 9-12 and called tracer.endExecution() itself. This is
    // idempotent (guarded by trace.complete) so it only fires if the page
    // didn't already close out the trace.
    if (traceId) {
      tracer.endExecution(traceId, true);
    }

    return getExecution(executionId)!;
  }

  private _waitForConfirmation(executionId: string, moduleId: ExecutionModuleId): Promise<void> {
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
    console.error(`[ExecutionBus] failed | id=${executionId} | error=${error}`);
    const record = failExecution(executionId, error);
    emitBusEvent('execution:error', executionId, moduleId, { error });
    return record;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const bus = new ExecutionBus();
export { ExecutionBus };
