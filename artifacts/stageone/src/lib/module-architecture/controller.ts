/**
 * STAGEONE Module Architecture — ModuleController Contract
 * Phase 1: Interface definition only. No existing module implements this yet.
 */

import type { ModuleContext } from './types';

/**
 * The shared contract every STAGEONE operational module must satisfy.
 *
 * Phase 2+ will replace placeholder controllers with real implementations
 * by satisfying this interface.
 */
export interface ModuleController {
  /**
   * Navigate to this module's primary view within the dashboard.
   */
  navigate(): Promise<void>;

  /**
   * Populate the module with data derived from the given context
   * (e.g. load project state, prime inputs, hydrate UI).
   */
  populate(context: ModuleContext): Promise<void>;

  /**
   * Trigger the module's primary AI generation workflow.
   */
  generate(): Promise<void>;

  /**
   * Persist the module's current output to the project.
   */
  save(): Promise<void>;
}
