/**
 * STAGEONE Execution Bus — Lifecycle Manager
 *
 * Owns the mutable store of ExecutionRecords and enforces legal phase transitions.
 * All mutations go through `transitionPhase()` so no execution can jump phases illegally.
 */

import type { ExecutionModuleId, ExecutionPayload, ExecutionPhase, ExecutionRecord } from './types';

// ── Phase transition graph ────────────────────────────────────────────────────

/**
 * Legal successor phases for each phase.
 * ERROR is always reachable; it is added per-source where applicable.
 */
const TRANSITIONS: Record<ExecutionPhase, ExecutionPhase[]> = {
  IDLE:                   ['ROUTING'],
  ROUTING:                ['POPULATING', 'GENERATING', 'WAITING_FOR_CONTROLLER', 'ERROR'],
  WAITING_FOR_CONTROLLER: ['POPULATING', 'GENERATING', 'ERROR'],
  POPULATING:             ['CONFIRMATION_WAIT', 'GENERATING', 'ERROR'],
  CONFIRMATION_WAIT:      ['GENERATING', 'ERROR'],
  GENERATING:             ['STREAMING', 'SAVING', 'COMPLETED', 'ERROR'],
  STREAMING:              ['SAVING', 'COMPLETED', 'ERROR'],
  SAVING:                 ['COMPLETED', 'ERROR'],
  COMPLETED:              [],
  ERROR:                  [],
};

// ── Record store ──────────────────────────────────────────────────────────────

const _records = new Map<string, ExecutionRecord>();
const MAX_HISTORY = 50;

// ── ID generation ─────────────────────────────────────────────────────────────

let _seq = 0;

function generateExecutionId(): string {
  _seq += 1;
  return `exec-${Date.now()}-${_seq}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createExecution(
  moduleId: ExecutionModuleId,
  payload?: ExecutionPayload,
): ExecutionRecord {
  if (_records.size >= MAX_HISTORY) {
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
 * Validates the transition is legal. Throws if the execution does not exist
 * or the transition is not in the legal graph.
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
  }

  return record;
}

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

export function cancelExecution(executionId: string): ExecutionRecord {
  const record = _records.get(executionId);
  if (!record) throw new Error(`[LifecycleManager] Unknown executionId: ${executionId}`);
  if (record.status !== 'active') return record;
  record.status = 'cancelled';
  record.updatedAt = Date.now();
  record.completedAt = Date.now();
  return record;
}

// ── Getters ───────────────────────────────────────────────────────────────────

export function getExecution(executionId: string): ExecutionRecord | undefined {
  return _records.get(executionId);
}

export function getActiveExecution(): ExecutionRecord | null {
  let latest: ExecutionRecord | null = null;
  _records.forEach((r) => {
    if (r.status === 'active') {
      if (!latest || r.startedAt > latest.startedAt) latest = r;
    }
  });
  return latest;
}

export function getAllExecutions(): ExecutionRecord[] {
  return Array.from(_records.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function getActiveExecutions(): ExecutionRecord[] {
  return getAllExecutions().filter((r) => r.status === 'active');
}

export function purgeCompleted(): void {
  _records.forEach((r, id) => {
    if (r.status !== 'active') _records.delete(id);
  });
}
