/**
 * STAGEONE Execution Bus — Module Registry Adapter
 *
 * The bus does not maintain a separate module registry.
 * Instead, this adapter bridges to the existing module-architecture registry
 * (`src/lib/module-architecture/registry.ts`) so there is exactly ONE place
 * where controllers register/unregister.
 *
 * Any page that registers via `registerController('website', websiteController)`
 * is automatically available to the bus — no duplicate registration needed.
 *
 * The `ExecutionModule` interface normalises the `ModuleController` contract
 * into the slightly different signature the bus uses internally.
 */

import { getController } from '@/lib/module-architecture/registry';
import type { ModuleContext } from '@/lib/module-architecture/types';
import type { ExecutionModuleId, ExecutionPayload } from './types';

/**
 * The interface the ExecutionBus calls into for each module.
 * Implemented by the adapter returned from `resolveExecutionModule()`.
 */
export interface ExecutionModule {
  /** Navigate to the module's primary route. */
  navigate(): Promise<void>;
  /** Hydrate the module's inputs from the given payload. */
  populate(payload: ExecutionPayload): Promise<void>;
  /** Trigger the module's full AI generation flow. */
  generate(): Promise<void>;
  /** Re-persist the current output to the project. */
  save(): Promise<void>;
}

/**
 * Resolve an ExecutionModule for the given module ID by looking up the
 * real controller from the module-architecture registry.
 *
 * Returns `null` if the controller is not currently registered (i.e. the
 * target page is not mounted). The caller must handle this case gracefully.
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

    save: () => controller.save(),
  };
}

/**
 * Return true if a controller for the given module is currently registered
 * (i.e. the target page is mounted and has registered its bridge).
 */
export function isModuleReady(moduleId: ExecutionModuleId): boolean {
  return getController(moduleId) !== undefined;
}

/**
 * Route string to ExecutionModuleId.
 * Useful when the Copilot sends a module name from a `{{WORKSPACE|run|...}}` tag.
 */
export function parseModuleId(raw: string): ExecutionModuleId | null {
  const map: Record<string, ExecutionModuleId> = {
    intelligence: 'intelligence',
    'business-intelligence': 'intelligence',
    bi: 'intelligence',
    website: 'website',
    'website-generator': 'website',
    chatbot: 'chatbot',
    'chatbot-generator': 'chatbot',
    automation: 'automation',
    'automation-builder': 'automation',
    orchestrator: 'orchestrator',
  };
  return map[raw.trim().toLowerCase()] ?? null;
}
