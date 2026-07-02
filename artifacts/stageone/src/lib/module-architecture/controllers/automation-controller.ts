/**
 * STAGEONE Module Architecture — Automation Builder Controller
 *
 * Phase 5: Real ModuleController implementation.
 *
 * All four methods delegate to the AutomationBridge, which is populated
 * by AutomationBuilderPage on mount. This keeps the controller as the
 * single operational interface while ensuring zero duplication of generation
 * logic — the existing generateWith, SSE parsing, and saveToProject flows
 * are untouched.
 *
 * Lifecycle events are emitted here, around the actual operations, so that
 * future subscribers (Copilot orchestration) can react to real execution
 * milestones.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';
import { getBridge } from '../automation-bridge';
import { emitLifecycleEvent } from '../lifecycle';

export const automationController: ModuleController = {
  /**
   * Navigate to the Automation Builder route.
   */
  async navigate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[AutomationController] navigate() — bridge not registered; is the Automation page mounted?');
      return;
    }
    bridge.navigate();
  },

  /**
   * Populate the Automation input fields with data from context.
   * Emits populate.started before population and populate.complete only
   * after all form fields have been fully committed to React state.
   */
  async populate(context: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[AutomationController] populate() — bridge not registered; is the Automation page mounted?');
      return;
    }

    emitLifecycleEvent('populate.started', 'automation', context);

    return new Promise<void>((resolve) => {
      bridge.populate(context.businessIdea ?? '', () => {
        emitLifecycleEvent('populate.complete', 'automation', { idea: context.businessIdea });
        resolve();
      });
    });
  },

  /**
   * Trigger the full automation generation flow.
   * Emits generate.started immediately before the API request and
   * generate.complete only after streaming, saving, and UI update are all done.
   */
  async generate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[AutomationController] generate() — bridge not registered; is the Automation page mounted?');
      return;
    }

    const idea = bridge.getCurrentIdea();
    emitLifecycleEvent('generate.started', 'automation', { idea });

    await bridge.triggerGenerate(idea);

    emitLifecycleEvent('generate.complete', 'automation', { idea });
  },

  /**
   * Re-save the current automation output to the active project.
   * No-op (with a warning) if the page is not mounted or has no output yet.
   */
  async save(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[AutomationController] save() — bridge not registered; is the Automation page mounted?');
      return;
    }
    await bridge.save();
  },
};
