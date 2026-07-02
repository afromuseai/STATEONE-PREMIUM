/**
 * STAGEONE Execution Bus — Public API
 *
 * Single import point for all execution-bus consumers.
 *
 * Quick-start:
 *
 *   import { bus } from '@/lib/execution-bus'
 *
 *   // Copilot / programmatic — full run with auto-approve:
 *   bus.execute({ module: 'website', action: 'run', payload: { idea, autoGenerate: true } })
 *
 *   // UI trigger — populate first, wait for Generate button:
 *   const record = await bus.execute({ module: 'website', action: 'populate', payload: { idea } })
 *   // ... user clicks Generate ...
 *   bus.approve(record.executionId)
 *
 *   // Subscribe to bus events:
 *   import { subscribeBusEvent } from '@/lib/execution-bus'
 *   const unsub = subscribeBusEvent('execution:completed', (e) => console.log(e))
 */

// ── Core singleton ────────────────────────────────────────────────────────────
export { bus } from './ExecutionBus';
export type { ExecutionBus } from './ExecutionBus';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ExecutionPhase,
  ExecutionModuleId,
  ExecutionAction,
  ExecutionPayload,
  ExecutionCommand,
  ExecutionRecord,
} from './types';

// ── Bus-level events ──────────────────────────────────────────────────────────
export type { BusEventType, BusEvent, BusEventHandler, BusEventWildcardHandler } from './events';
export {
  subscribeBusEvent,
  subscribeBusEventAll,
  unsubscribeBusEvent,
} from './events';

// ── Module registry helpers ───────────────────────────────────────────────────
export type { ExecutionModule } from './module-registry';
export { resolveExecutionModule, isModuleReady, parseModuleId } from './module-registry';

// ── Lifecycle read-only accessors ─────────────────────────────────────────────
export {
  getExecution,
  getActiveExecution,
  getActiveExecutions,
  getAllExecutions,
  purgeCompleted,
} from './lifecycle-manager';
