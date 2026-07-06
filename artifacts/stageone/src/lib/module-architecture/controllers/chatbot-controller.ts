/**
 * STAGEONE Module Architecture — Chatbot Generator Controller
 *
 * Phase 4: Real ModuleController implementation.
 *
 * All four methods delegate to the ChatbotBridge, which is populated
 * by ChatbotGeneratorPage on mount. This keeps the controller as the
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
import { getBridge } from '../chatbot-bridge';
import { emitLifecycleEvent } from '../lifecycle';

export const chatbotController: ModuleController = {
  /**
   * Navigate to the Chatbot Generator route.
   */
  async navigate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[ChatbotController] navigate() — bridge not registered; is the Chatbot page mounted?');
      return;
    }
    bridge.navigate();
  },

  /**
   * Populate the Chatbot input via the typewriter animation.
   * Emits populate.started before the animation and populate.complete only
   * after the entire description has finished typing and the form is ready
   * for user review.
   */
  async populate(context: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[ChatbotController] populate() — bridge not registered; is the Chatbot page mounted?');
      return;
    }

    emitLifecycleEvent('populate.started', 'chatbot', context);

    return new Promise<void>((resolve) => {
      bridge.populate(context.businessIdea ?? '', () => {
        emitLifecycleEvent('populate.complete', 'chatbot', { idea: context.businessIdea });
        resolve();
      });
    });
  },

  /**
   * Trigger the full chatbot generation flow.
   * Emits generate.started immediately before the API request and
   * generate.complete only after streaming, saving, and UI update are all done.
   */
  async generate(context?: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[ChatbotController] generate() — bridge not registered; is the Chatbot page mounted?');
      return;
    }

    const idea = bridge.getCurrentIdea() || context?.businessIdea || '';
    emitLifecycleEvent('generate.started', 'chatbot', { idea });

    await bridge.triggerGenerate(idea);

    emitLifecycleEvent('generate.complete', 'chatbot', { idea });
  },

  /**
   * Re-save the current chatbot output to the active project.
   * No-op (with a warning) if the page is not mounted or has no output yet.
   */
  async save(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[ChatbotController] save() — bridge not registered; is the Chatbot page mounted?');
      return;
    }
    await bridge.save();
  },
};
