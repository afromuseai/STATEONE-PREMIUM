/**
 * STAGEONE Module Architecture — Module Registry
 * Phase 1: Infrastructure only. No module registers itself here yet.
 */

import type { ModuleController } from './controller';
import type { ModuleId } from './types';

const _registry = new Map<ModuleId, ModuleController>();

/**
 * Register a controller for the given module ID.
 * Overwrites any previously registered controller for that ID.
 */
export function registerController(id: ModuleId, controller: ModuleController): void {
  _registry.set(id, controller);
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
