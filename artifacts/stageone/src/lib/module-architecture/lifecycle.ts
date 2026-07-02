/**
 * STAGEONE Module Architecture — Lifecycle Event System
 * Phase 1: Infrastructure only. Nothing emits or consumes these events yet.
 */

import type { LifecycleEvent, LifecycleEventType, ModuleId } from './types';

export type LifecycleHandler = (event: LifecycleEvent) => void;

const _subscribers = new Map<LifecycleEventType, Set<LifecycleHandler>>();

/**
 * Emit a lifecycle event to all registered subscribers for that event type.
 * No-op if no subscribers are registered for the given type.
 */
export function emitLifecycleEvent(
  type: LifecycleEventType,
  moduleId: ModuleId,
  payload?: unknown,
): void {
  const event: LifecycleEvent = { type, moduleId, timestamp: Date.now(), payload };
  const handlers = _subscribers.get(type);
  if (handlers) {
    handlers.forEach((h) => h(event));
  }
}

/**
 * Subscribe to a lifecycle event type.
 * The handler will be called every time that event is emitted.
 */
export function subscribeLifecycleEvent(
  type: LifecycleEventType,
  handler: LifecycleHandler,
): void {
  if (!_subscribers.has(type)) {
    _subscribers.set(type, new Set());
  }
  _subscribers.get(type)!.add(handler);
}

/**
 * Unsubscribe a previously registered handler from a lifecycle event type.
 * No-op if the handler was not subscribed.
 */
export function unsubscribeLifecycleEvent(
  type: LifecycleEventType,
  handler: LifecycleHandler,
): void {
  _subscribers.get(type)?.delete(handler);
}

/**
 * Return a Promise that resolves with the next occurrence of the given
 * lifecycle event type. Optionally rejects after `timeoutMs` milliseconds.
 */
export function awaitLifecycleEvent(
  type: LifecycleEventType,
  timeoutMs?: number,
): Promise<LifecycleEvent> {
  return new Promise<LifecycleEvent>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handler: LifecycleHandler = (event) => {
      unsubscribeLifecycleEvent(type, handler);
      if (timer !== undefined) clearTimeout(timer);
      resolve(event);
    };

    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        unsubscribeLifecycleEvent(type, handler);
        reject(new Error(`[ModuleArchitecture] Timeout (${timeoutMs}ms) waiting for lifecycle event: ${type}`));
      }, timeoutMs);
    }

    subscribeLifecycleEvent(type, handler);
  });
}
