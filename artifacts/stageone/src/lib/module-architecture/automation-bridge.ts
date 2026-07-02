/**
 * STAGEONE Module Architecture — Automation Builder Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Automation Builder state. The Automation page registers its imperative
 * handlers here on mount and unregisters on unmount. The controller reads from
 * this bridge so it can delegate to the existing implementation without
 * duplicating any generation logic.
 *
 * Phase 5 only. No other module uses this file.
 */

export interface AutomationBridge {
  /** Navigate to the Automation Builder route. */
  navigate: () => void;

  /**
   * Populate the automation input fields with a given business idea.
   * Calls `onComplete` only after all form fields (textarea, workflow type,
   * complexity) have been fully committed to React state.
   */
  populate: (idea: string, onComplete: () => void) => void;

  /**
   * Trigger the full automation generation flow (fetch → SSE stream → project save).
   * The returned Promise resolves only after streaming, saving, and UI update
   * are all complete.
   */
  triggerGenerate: (idea: string) => Promise<void>;

  /**
   * Re-save the current automation output to the active project.
   * No-op if there is no output yet.
   */
  save: () => Promise<void>;

  /** Return the business description currently held in the input ref. */
  getCurrentIdea: () => string;
}

let _bridge: AutomationBridge | null = null;

/** Called by AutomationBuilderPage on mount to register its handlers. */
export function registerBridge(bridge: AutomationBridge): void {
  _bridge = bridge;
}

/** Called by AutomationBuilderPage on unmount to clean up. */
export function unregisterBridge(): void {
  _bridge = null;
}

/** Read by automationController to call into the page's live handlers. */
export function getBridge(): AutomationBridge | null {
  return _bridge;
}
