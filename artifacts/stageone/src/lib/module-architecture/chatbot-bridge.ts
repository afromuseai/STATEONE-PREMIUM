/**
 * STAGEONE Module Architecture — Chatbot Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Chatbot Generator state. The Chatbot page registers its imperative
 * handlers here on mount and unregisters on unmount. The controller reads from
 * this bridge so it can delegate to the existing implementation without
 * duplicating any generation logic.
 *
 * Phase 4 only. No other module uses this file.
 */

export interface ChatbotBridge {
  /** Navigate to the Chatbot Generator route. */
  navigate: () => void;

  /**
   * Start the typewriter populate animation for a given business idea.
   * Calls `onComplete` when the animation finishes (typewriter done, form ready
   * for user review).
   */
  populate: (idea: string, onComplete: () => void) => void;

  /**
   * Trigger the full chatbot generation flow (fetch → SSE stream → project save).
   * The returned Promise resolves only after streaming, saving, and UI update
   * are all complete.
   */
  triggerGenerate: (idea: string) => Promise<void>;

  /**
   * Re-save the current chatbot output to the active project.
   * No-op if there is no output yet.
   */
  save: () => Promise<void>;

  /** Return the business description currently held in the input ref. */
  getCurrentIdea: () => string;
}

let _bridge: ChatbotBridge | null = null;

/** Called by ChatbotGeneratorPage on mount to register its handlers. */
export function registerBridge(bridge: ChatbotBridge): void {
  _bridge = bridge;
}

/** Called by ChatbotGeneratorPage on unmount to clean up. */
export function unregisterBridge(): void {
  _bridge = null;
}

/** Read by chatbotController to call into the page's live handlers. */
export function getBridge(): ChatbotBridge | null {
  return _bridge;
}
