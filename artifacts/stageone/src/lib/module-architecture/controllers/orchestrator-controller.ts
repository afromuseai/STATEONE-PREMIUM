/**
 * STAGEONE Module Architecture — Orchestrator Controller
 *
 * Real ModuleController implementation that delegates to the OrchestratorBridge,
 * which is populated by OrchestratorPage on mount. This keeps the controller as
 * the single operational interface while ensuring zero duplication of generation
 * logic — the existing generate(), SSE parsing, and saveToProject flows are
 * untouched.
 *
 * Lifecycle events are emitted here, around the actual operations, so that
 * future subscribers (Copilot orchestration) can react to real execution
 * milestones.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';
import { getBridge } from '../orchestrator-bridge';
import { emitLifecycleEvent } from '../lifecycle';

export const orchestratorController: ModuleController = {
  /**
   * Navigate to the Orchestrator route.
   */
  async navigate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[OrchestratorController] navigate() — bridge not registered; is the Orchestrator page mounted?');
      return;
    }
    bridge.navigate();
  },

  /**
   * Populate the goal input with data from context.
   * Emits populate.started before population and populate.complete only
   * after the goal field has been fully committed to React state.
   */
  async populate(context: ModuleContext): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[OrchestratorController] populate() — bridge not registered; is the Orchestrator page mounted?');
      return;
    }

    emitLifecycleEvent('populate.started', 'orchestrator', context);

    return new Promise<void>((resolve) => {
      bridge.populate(context.businessIdea ?? '', () => {
        emitLifecycleEvent('populate.complete', 'orchestrator', { idea: context.businessIdea });
        resolve();
      });
    });
  },

  /**
   * Trigger the full orchestrator generation flow.
   * Emits generate.started immediately before the API request and
   * generate.complete only after streaming, saving, and UI update are all done.
   */
  async generate(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[OrchestratorController] generate() — bridge not registered; is the Orchestrator page mounted?');
      return;
    }

    const idea = bridge.getCurrentIdea();
    emitLifecycleEvent('generate.started', 'orchestrator', { idea });

    await bridge.triggerGenerate(idea);

    emitLifecycleEvent('generate.complete', 'orchestrator', { idea });
  },

  /**
   * Save the current orchestrator output to the active project.
   * The orchestrator saves inline during generation; this is a no-op guard.
   */
  async save(): Promise<void> {
    const bridge = getBridge();
    if (!bridge) {
      console.warn('[OrchestratorController] save() — bridge not registered; is the Orchestrator page mounted?');
      return;
    }
    await bridge.save();
  },
};
