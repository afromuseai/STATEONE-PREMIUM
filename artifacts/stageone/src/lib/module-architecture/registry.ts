/**
 * STAGEONE Module Architecture — Module Registry
 */

import type { ModuleController } from './controller';
import type { ModuleId } from './types';

const _registry = new Map<ModuleId, ModuleController>();

// ── Registration hooks ────────────────────────────────────────────────────────
// External subscribers (e.g. ExecutionBus) can listen for controller registration
// events so they can resume pending executions when a page mounts.

type RegistrationHandler = (id: ModuleId, controller: ModuleController) => void;

const _registrationHandlers = new Set<RegistrationHandler>();

/**
 * Subscribe to controller registration events.
 * The handler is called synchronously inside `registerController()` immediately
 * after the controller is stored — so `getController(id)` already returns it.
 * Returns an unsubscribe function.
 */
export function subscribeControllerRegistration(handler: RegistrationHandler): () => void {
  _registrationHandlers.add(handler);
  return () => _registrationHandlers.delete(handler);
}

// ── Registry operations ───────────────────────────────────────────────────────

/**
 * Register a controller for the given module ID.
 * Overwrites any previously registered controller for that ID.
 * Notifies all registration subscribers after storing.
 */
export function registerController(id: ModuleId, controller: ModuleController): void {
  _registry.set(id, controller);
  _registrationHandlers.forEach((h) => {
    try { h(id, controller); } catch (err) {
      console.error('[ModuleRegistry] registration handler threw:', err);
    }
  });
}

/**
 * Remove the controller registered for the given module ID.
 * No-op if the module was not registered.
 */
export function unregisterController(id: ModuleId): void {
  _registry.delete(id);
}

/**
 * Retrieve the controller registered for the given module ID.
 * Returns `undefined` if no controller has been registered yet.
 */
export function getController(id: ModuleId): ModuleController | undefined {
  return _registry.get(id);
}

/**
 * Return the IDs of all currently registered modules.
 */
export function getRegisteredModules(): ModuleId[] {
  return Array.from(_registry.keys());
}
