/**
 * STAGEONE Module Architecture — Intelligence Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Business Intelligence state. The BI page registers its imperative
 * handlers here on mount and unregisters on unmount. The controller reads from
 * this bridge so it can delegate to the existing implementation without
 * duplicating any generation logic.
 *
 * Phase 2 only. No other module uses this pattern yet.
 */

export interface IntelligenceBridge {
  /** Navigate to the Business Intelligence route. */
  navigate: () => void;

  /**
   * Start the typewriter populate animation for a given business idea.
   * Calls `onComplete` when the animation finishes.
   */
  populate: (idea: string, onComplete: () => void) => void;

  /**
   * Trigger the full BI generation flow (fetch → SSE stream → auto-save).
   * The returned Promise resolves only after streaming, saving, and UI update
   * are all complete.
   */
  triggerGenerate: (idea: string) => Promise<void>;

  /**
   * Re-save the current BI results to the active project.
   * No-op if there are no results or no active project yet.
   */
  save: () => Promise<void>;

  /** Return the business idea currently held in the input ref. */
  getCurrentIdea: () => string;
}

let _bridge: IntelligenceBridge | null = null;

/** Called by BusinessIntelligencePage on mount to register its handlers. */
export function registerBridge(bridge: IntelligenceBridge): void {
  _bridge = bridge;
}

/** Called by BusinessIntelligencePage on unmount to clean up. */
export function unregisterBridge(): void {
  _bridge = null;
}

/** Read by intelligenceController to call into the page's live handlers. */
export function getBridge(): IntelligenceBridge | null {
  return _bridge;
}
