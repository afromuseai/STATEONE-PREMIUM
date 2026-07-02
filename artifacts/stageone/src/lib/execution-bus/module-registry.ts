/**
 * STAGEONE Execution Bus — Module Registry Adapter
 *
 * Bridges to the existing module-architecture registry (`registry.ts`) so there
 * is exactly ONE place where controllers register/unregister.
 *
 * Any page that calls `registerController('website', controller)` is automatically
 * available to the bus — no duplicate registration needed.
 */

import { getController } from '@/lib/module-architecture/registry';
import type { ModuleContext } from '@/lib/module-architecture/types';
import type { ExecutionModuleId, ExecutionPayload } from './types';

/**
 * Route each module maps to.
 * Used by ExecutionBus to navigate when the target page is not yet mounted.
 */
export const MODULE_ROUTES: Record<ExecutionModuleId, string> = {
  intelligence: '/business-intelligence',
  website:      '/website-generator',
  chatbot:      '/chatbot-generator',
  automation:   '/automation-builder',
  orchestrator: '/orchestrator',
};

/**
 * The interface ExecutionBus calls into for each module.
 * Implemented by the adapter returned from `resolveExecutionModule()`.
 */
export interface ExecutionModule {
  navigate(): Promise<void>;
  populate(payload: ExecutionPayload): Promise<void>;
  generate(): Promise<void>;
  save(): Promise<void>;
}

/**
 * Resolve an ExecutionModule for the given module ID by looking up the real
 * controller from the module-architecture registry.
 *
 * Returns `null` if the controller is not currently registered (target page not mounted).
 * The bus handles this by parking in WAITING_FOR_CONTROLLER until registration fires.
 */
export function resolveExecutionModule(moduleId: ExecutionModuleId): ExecutionModule | null {
  const controller = getController(moduleId);
  if (!controller) return null;

  return {
    navigate: () => controller.navigate(),

    populate: (payload: ExecutionPayload) => {
      const context: ModuleContext = {
        moduleId,
        projectId: payload.projectId,
        userId: payload.userId,
        businessIdea: payload.idea,
        metadata: payload.metadata,
      };
      return controller.populate(context);
    },

    generate: () => controller.generate(),
    save:     () => controller.save(),
  };
}

/**
 * Return true if a controller for the given module is currently registered.
 */
export function isModuleReady(moduleId: ExecutionModuleId): boolean {
  return getController(moduleId) !== undefined;
}

/**
 * Parse a raw module-name string (from Copilot {{WORKSPACE|run|...}} tags)
 * into an ExecutionModuleId. Returns null for unrecognised values.
 */
export function parseModuleId(raw: string): ExecutionModuleId | null {
  const map: Record<string, ExecutionModuleId> = {
    intelligence:           'intelligence',
    'business-intelligence':'intelligence',
    bi:                     'intelligence',
    website:                'website',
    'website-generator':    'website',
    chatbot:                'chatbot',
    'chatbot-generator':    'chatbot',
    automation:             'automation',
    'automation-builder':   'automation',
    orchestrator:           'orchestrator',
  };
  return map[raw.trim().toLowerCase()] ?? null;
}
