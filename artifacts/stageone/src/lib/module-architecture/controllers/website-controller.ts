/**
 * STAGEONE Module Architecture — Website Generator Controller
 *
 * Phase 3: Real ModuleController implementation.
 *
 * All four methods delegate to the WebsiteBridge, which is populated
 * by WebsiteGeneratorPage on mount. This keeps the controller as the
 * single operational interface while ensuring zero duplication of generation
 * logic — the existing generateWithIdea, SSE parsing, and ensureProject
 * flows are untouched.
 *
 * Lifecycle events are emitted here, around the actual operations, so that
 * future subscribers (Phase 7+ Copilot orchestration) can react to real
 * execution milestones.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';
import { getBridge } from '../website-bridge';
import { emitLifecycleEvent } from '../lifecycle';

export const websiteController: ModuleController = {
  /**
   * Navigate to the Website Generator route.
   */
  async navigate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[WebsiteController] navigate() — bridge not registered; is the Website page mounted?');
      return;
    }
    bridge.navigate();
  },

  /**
   * Populate the Website input via the typewriter animation.
   * Emits populate.started before the animation and populate.complete when it finishes.
   */
  async populate(context: ModuleContext): Promise<void> {
    console.log('[PROBE] WEBSITE_CONTROLLER_POPULATE_START | businessIdea:', JSON.stringify(context.businessIdea?.slice(0, 60)));
    const bridge = getBridge();
    console.log('[PROBE] getBridge() result inside populate:', bridge ? 'BRIDGE PRESENT' : 'NULL — will silent-return');
    if (!bridge) {
      console.warn('[WebsiteController] populate() — bridge not registered; is the Website page mounted?');
      return;
    }

    emitLifecycleEvent('populate.started', 'website', context);

    return new Promise<void>((resolve) => {
      bridge.populate(context.businessIdea ?? '', () => {
        emitLifecycleEvent('populate.complete', 'website', { idea: context.businessIdea });
        resolve();
      });
    });
  },

  /**
   * Trigger the full website generation flow.
   * Emits generate.started immediately before the API request and
   * generate.complete only after streaming, saving, and UI update are all done.
   *
   * @param context - Optional context forwarded from the execution payload.
   *   context.businessIdea is used as a fallback when the bridge's ideaRef is
   *   empty (e.g. the component just remounted and the typewriter has not yet run).
   */
  async generate(context?: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[WebsiteController] generate() — bridge not registered; is the Website page mounted?');
      return;
    }

    // Prefer the live textarea value; fall back to the payload idea forwarded
    // by the bus if ideaRef is not yet populated (e.g. remount before typewriter).
    const idea = bridge.getCurrentIdea() || context?.businessIdea || '';
    emitLifecycleEvent('generate.started', 'website', { idea });

    await bridge.triggerGenerate(idea);

    emitLifecycleEvent('generate.complete', 'website', { idea });
  },

  /**
   * Re-save the current website output to the active project.
   * No-op (with a warning) if the page is not mounted or has no output yet.
   */
  async save(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[WebsiteController] save() — bridge not registered; is the Website page mounted?');
      return;
    }
    await bridge.save();
  },
};
