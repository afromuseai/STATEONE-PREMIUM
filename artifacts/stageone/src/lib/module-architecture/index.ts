/**
 * STAGEONE Module Architecture — Public API
 *
 * Phase 1 exports. Phase 2+ replaces placeholder controllers by satisfying
 * the ModuleController interface and calling registerController().
 *
 * Usage (Phase 2+):
 *   import { registerController, intelligenceController } from '@/lib/module-architecture';
 *   registerController('intelligence', myRealIntelligenceController);
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ModuleId,
  ModuleState,
  ModuleContext,
  LifecycleEvent,
  LifecycleEventType,
} from './types';

// ── Controller contract ───────────────────────────────────────────────────────
export type { ModuleController } from './controller';

// ── Registry ─────────────────────────────────────────────────────────────────
export {
  registerController,
  unregisterController,
  getController,
  getRegisteredModules,
} from './registry';

// ── Lifecycle event system ────────────────────────────────────────────────────
export {
  emitLifecycleEvent,
  subscribeLifecycleEvent,
  unsubscribeLifecycleEvent,
  awaitLifecycleEvent,
} from './lifecycle';
export type { LifecycleHandler } from './lifecycle';

// ── Placeholder controllers ───────────────────────────────────────────────────
export { intelligenceController } from './controllers/intelligence-controller';
export { chatbotController } from './controllers/chatbot-controller';
export { automationController } from './controllers/automation-controller';
export { orchestratorController } from './controllers/orchestrator-controller';
