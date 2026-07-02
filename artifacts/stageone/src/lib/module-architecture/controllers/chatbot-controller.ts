/**
 * STAGEONE Module Architecture — Chatbot Generator Placeholder Controller
 * Phase 1: Satisfies ModuleController contract. Not wired into production code.
 */

import type { ModuleController } from '../controller';
import type { ModuleContext } from '../types';

export const chatbotController: ModuleController = {
  async navigate(): Promise<void> {
    console.warn('[ChatbotController] navigate() — Phase 2 implementation pending');
  },

  async populate(_context: ModuleContext): Promise<void> {
    console.warn('[ChatbotController] populate() — Phase 2 implementation pending');
  },

  async generate(): Promise<void> {
    console.warn('[ChatbotController] generate() — Phase 2 implementation pending');
  },

  async save(): Promise<void> {
    console.warn('[ChatbotController] save() — Phase 2 implementation pending');
  },
};
