/**
 * STAGEONE Module Architecture — Automation Builder Placeholder Controller
 * Phase 1: Satisfies ModuleController contract. Not wired into production code.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';

export const automationController: ModuleController = {
  async navigate(): Promise<void> {
    console.warn('[AutomationController] navigate() — Phase 2 implementation pending');
  },

  async populate(_context: ModuleContext): Promise<void> {
    console.warn('[AutomationController] populate() — Phase 2 implementation pending');
  },

  async generate(): Promise<void> {
    console.warn('[AutomationController] generate() — Phase 2 implementation pending');
  },

  async save(): Promise<void> {
    console.warn('[AutomationController] save() — Phase 2 implementation pending');
  },
};
