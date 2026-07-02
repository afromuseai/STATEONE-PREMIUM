/**
 * STAGEONE Execution Bus — Bus-Level Event System
 *
 * Separate from the module-architecture lifecycle events (populate.started, etc.).
 * These events describe coarse execution milestones visible to any consumer:
 * Copilot, UI overlays, analytics, future orchestration layers.
 *
 * Naming convention: execution:<verb>_<noun>
 */

import type { ExecutionModuleId } from './types';

/** All bus-level event types. */
export type BusEventType =
  | 'execution:routing'
  | 'execution:populate_started'
  | 'execution:populate_complete'
  | 'execution:confirmation_required'
  | 'execution:confirmation_approved'
  | 'execution:generate_started'
  | 'execution:generate_complete'
  | 'execution:saving'
  | 'execution:completed'
  | 'execution:cancelled'
  | 'execution:error';

/** A single bus event payload. */
export interface BusEvent {
  type: BusEventType;
  executionId: string;
  moduleId: ExecutionModuleId;
  /** Unix ms. */
  timestamp: number;
  /** Event-specific data. */
  payload?: unknown;
}

export type BusEventHandler = (event: BusEvent) => void;

/** Wildcard subscriber type — receives every event regardless of type. */
export type BusEventWildcardHandler = (event: BusEvent) => void;

// ── Internal subscriber maps ──────────────────────────────────────────────────

const _typeSubscribers = new Map<BusEventType, Set<BusEventHandler>>();
const _wildcardSubscribers = new Set<BusEventWildcardHandler>();

// ── Emit ──────────────────────────────────────────────────────────────────────

/**
 * Emit a bus event. Called exclusively by ExecutionBus internals.
 * Errors thrown by subscriber handlers are caught and logged individually
 * so a bad subscriber never kills an execution.
 */
export function emitBusEvent(
  type: BusEventType,
  executionId: string,
  moduleId: ExecutionModuleId,
  payload?: unknown,
): void {
  const event: BusEvent = { type, executionId, moduleId, timestamp: Date.now(), payload };

  const handlers = _typeSubscribers.get(type);
  if (handlers) {
    handlers.forEach((h) => {
      try { h(event); } catch (err) {
        console.error('[ExecutionBus] event handler threw', type, err);
      }
    });
  }

  _wildcardSubscribers.forEach((h) => {
    try { h(event); } catch (err) {
      console.error('[ExecutionBus] wildcard handler threw', err);
    }
  });
}

// ── Subscribe / unsubscribe ───────────────────────────────────────────────────

/** Subscribe to a specific event type. Returns an unsubscribe function. */
export function subscribeBusEvent(
  type: BusEventType,
  handler: BusEventHandler,
): () => void {
  if (!_typeSubscribers.has(type)) {
    _typeSubscribers.set(type, new Set());
  }
  _typeSubscribers.get(type)!.add(handler);
  return () => _typeSubscribers.get(type)?.delete(handler);
}

/** Subscribe to ALL bus events (wildcard). Returns an unsubscribe function. */
export function subscribeBusEventAll(handler: BusEventWildcardHandler): () => void {
  _wildcardSubscribers.add(handler);
  return () => _wildcardSubscribers.delete(handler);
}

/** Unsubscribe a previously registered type handler. */
export function unsubscribeBusEvent(type: BusEventType, handler: BusEventHandler): void {
  _typeSubscribers.get(type)?.delete(handler);
}
