/**
 * STAGEONE Execution Bus — Lifecycle Manager
 *
 * Owns the mutable store of ExecutionRecords and enforces legal phase transitions.
 * All mutations go through `transitionPhase()` so no execution can jump phases illegally.
 *
 * This is a singleton module (plain TS, no React). The ExecutionBus is its only writer.
 * UI components and tests read via the getter functions.
 */

import type { ExecutionModuleId, ExecutionPayload, ExecutionPhase, ExecutionRecord } from './types';

// ── Phase transition graph ────────────────────────────────────────────────────

/**
 * Legal successor phases for each phase.
 * ERROR is reachable from any active phase.
 */
const TRANSITIONS: Record<ExecutionPhase, ExecutionPhase[]> = {
  IDLE:               ['ROUTING'],
  ROUTING:            ['POPULATING', 'GENERATING', 'ERROR'],
  POPULATING:         ['CONFIRMATION_WAIT', 'ERROR'],
  CONFIRMATION_WAIT:  ['GENERATING', 'CANCELLED' as ExecutionPhase, 'ERROR'],
  GENERATING:         ['STREAMING', 'SAVING', 'COMPLETED', 'ERROR'],
  STREAMING:          ['SAVING', 'COMPLETED', 'ERROR'],
  SAVING:             ['COMPLETED', 'ERROR'],
  COMPLETED:          [],
  ERROR:              [],
};

// ── Record store ──────────────────────────────────────────────────────────────

/** Active and recently-completed executions (capped at MAX_HISTORY). */
const _records = new Map<string, ExecutionRecord>();
const MAX_HISTORY = 50;

// ── ID generation ─────────────────────────────────────────────────────────────

let _seq = 0;

function generateExecutionId(): string {
  _seq += 1;
  return `exec-${Date.now()}-${_seq}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new execution record in the IDLE phase.
 * Automatically evicts oldest entries if the store is at capacity.
 */
export function createExecution(
  moduleId: ExecutionModuleId,
  payload?: ExecutionPayload,
): ExecutionRecord {
  if (_records.size >= MAX_HISTORY) {
    // Evict the oldest completed/failed/cancelled entry first; if none, the oldest active one.
    const sorted = Array.from(_records.values()).sort((a, b) => a.startedAt - b.startedAt);
    const victim = sorted.find(r => r.status !== 'active') ?? sorted[0];
    if (victim) _records.delete(victim.executionId);
  }

  const record: ExecutionRecord = {
    executionId: generateExecutionId(),
    moduleId,
    phase: 'IDLE',
    status: 'active',
    payload,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  _records.set(record.executionId, record);
  return record;
}

/**
 * Transition an execution to a new phase.
 *
 * Validates the transition is legal (see TRANSITIONS graph above).
 * Throws if the execution does not exist or the transition is illegal.
 */
export function transitionPhase(executionId: string, next: ExecutionPhase): ExecutionRecord {
  const record = _records.get(executionId);
  if (!record) {
    throw new Error(`[LifecycleManager] Unknown executionId: ${executionId}`);
  }

  const allowed = TRANSITIONS[record.phase] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `[LifecycleManager] Illegal phase transition: ${record.phase} → ${next} (execution: ${executionId})`
    );
  }

  record.phase = next;
  record.updatedAt = Date.now();

  if (next === 'COMPLETED') {
    record.status = 'completed';
    record.completedAt = Date.now();
  } else if (next === 'ERROR') {
    record.status = 'failed';
    record.completedAt = Date.now();
  } else if ((next as string) === 'CANCELLED') {
    record.status = 'cancelled';
    record.completedAt = Date.now();
  }

  return record;
}

/** Mark an execution as failed with an error message. */
export function failExecution(executionId: string, error: string): ExecutionRecord {
  const record = _records.get(executionId);
  if (!record) throw new Error(`[LifecycleManager] Unknown executionId: ${executionId}`);

  record.phase = 'ERROR';
  record.status = 'failed';
  record.error = error;
  record.updatedAt = Date.now();
  record.completedAt = Date.now();
  return record;
}

/** Mark an execution as cancelled. */
export function cancelExecution(executionId: string): ExecutionRecord {
  const record = _records.get(executionId);
  if (!record) throw new Error(`[LifecycleManager] Unknown executionId: ${executionId}`);
  if (record.status !== 'active') return record; // already terminal

  record.phase = 'IDLE' as ExecutionPhase;
  record.status = 'cancelled';
  record.updatedAt = Date.now();
  record.completedAt = Date.now();
  return record;
}

// ── Getters ───────────────────────────────────────────────────────────────────

/** Get a single execution record by ID. */
export function getExecution(executionId: string): ExecutionRecord | undefined {
  return _records.get(executionId);
}

/** Return the most recently started active execution, or null if none. */
export function getActiveExecution(): ExecutionRecord | null {
  let latest: ExecutionRecord | null = null;
  _records.forEach((r) => {
    if (r.status === 'active') {
      if (!latest || r.startedAt > latest.startedAt) latest = r;
    }
  });
  return latest;
}

/** Return all recorded executions sorted newest-first. */
export function getAllExecutions(): ExecutionRecord[] {
  return Array.from(_records.values()).sort((a, b) => b.startedAt - a.startedAt);
}

/** Return all active (in-progress) executions. */
export function getActiveExecutions(): ExecutionRecord[] {
  return getAllExecutions().filter((r) => r.status === 'active');
}

/** Remove all completed/failed/cancelled records (keeps active ones). */
export function purgeCompleted(): void {
  _records.forEach((r, id) => {
    if (r.status !== 'active') _records.delete(id);
  });
}
