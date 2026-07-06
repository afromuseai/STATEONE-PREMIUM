/**
 * STAGEONE Module Architecture — Module Registry
 */

import type { ModuleController } from './controller';
import type { ModuleId } from './types';

const _registry = new Map<ModuleId, ModuleController>();
// Per-module registration IDs — prevent a stale cleanup from a dead duplicate
// fiber from removing the controller registered by the live instance.
const _regIds = new Map<ModuleId, number>();
let _regIdCounter = 0;

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
 * Returns a registration ID that must be passed to unregisterController().
 */
export function registerController(id: ModuleId, controller: ModuleController): number {
  const regId = ++_regIdCounter;
  _registry.set(id, controller);
  _regIds.set(id, regId);
  console.log(`[PROBE] CONTROLLER_REGISTER | module=${id} | registrationId=${regId}`);
  _registrationHandlers.forEach((h) => {
    try { h(id, controller); } catch (err) {
      console.error('[ModuleRegistry] registration handler threw:', err);
    }
  });
  return regId;
}

/**
 * Remove the controller registered for the given module ID.
 * When registrationId is supplied, the removal is a no-op if the stored ID
 * does not match — this prevents a stale cleanup from a dead duplicate fiber
 * from removing the live instance's controller.
 * No-op if the module was not registered.
 */
export function unregisterController(id: ModuleId, registrationId?: number): void {
  const currentRegId = _regIds.get(id);
  if (registrationId !== undefined && currentRegId !== registrationId) {
    console.log(
      `[PROBE] CONTROLLER_UNREGISTER | module=${id} | registrationId=${registrationId} | currentRegId=${currentRegId} | SKIPPED (stale cleanup)`
    );
    return;
  }
  console.log(
    `[PROBE] CONTROLLER_UNREGISTER | module=${id} | registrationId=${registrationId ?? '(none)'} | currentRegId=${currentRegId} | CLEARED`
  );
  _registry.delete(id);
  _regIds.delete(id);
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
