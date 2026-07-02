/**
 * STAGEONE Module Architecture — Business Intelligence Controller
 *
 * Phase 2: Real ModuleController implementation.
 *
 * All four methods delegate to the IntelligenceBridge, which is populated
 * by BusinessIntelligencePage on mount. This keeps the controller as the
 * single operational interface while ensuring zero duplication of generation
 * logic — the existing handleGenerate, SSE parsing, and save flows are
 * untouched.
 *
 * Lifecycle events are emitted here, around the actual operations, so that
 * future subscribers (Phase 7+ Copilot orchestration) can react to real
 * execution milestones.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';
import { getBridge } from '../intelligence-bridge';
import { emitLifecycleEvent } from '../lifecycle';

export const intelligenceController: ModuleController = {
  /**
   * Navigate to the Business Intelligence route.
   */
  async navigate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[IntelligenceController] navigate() — bridge not registered; is the BI page mounted?');
      return;
    }
    bridge.navigate();
  },

  /**
   * Populate the BI input via the typewriter animation.
   * Emits populate.started before the animation and populate.complete when it finishes.
   */
  async populate(context: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[IntelligenceController] populate() — bridge not registered; is the BI page mounted?');
      return;
    }

    emitLifecycleEvent('populate.started', 'intelligence', context);

    return new Promise<void>((resolve) => {
      bridge.populate(context.businessIdea ?? '', () => {
        emitLifecycleEvent('populate.complete', 'intelligence', { idea: context.businessIdea });
        resolve();
      });
    });
  },

  /**
   * Trigger the full BI generation flow.
   * Emits generate.started immediately before the API request and
   * generate.complete only after streaming, saving, and UI update are all done.
   */
  async generate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[IntelligenceController] generate() — bridge not registered; is the BI page mounted?');
      return;
    }

    const idea = bridge.getCurrentIdea();
    emitLifecycleEvent('generate.started', 'intelligence', { idea });

    await bridge.triggerGenerate(idea);

    emitLifecycleEvent('generate.complete', 'intelligence', { idea });
  },

  /**
   * Re-save the current BI results to the active project.
   * No-op (with a warning) if the page is not mounted or has no results yet.
   */
  async save(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[IntelligenceController] save() — bridge not registered; is the BI page mounted?');
      return;
    }
    await bridge.save();
  },
};
