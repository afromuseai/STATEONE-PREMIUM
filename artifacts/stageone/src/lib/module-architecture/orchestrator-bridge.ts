/**
 * STAGEONE Module Architecture — Orchestrator Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Orchestrator state. The Orchestrator page registers its imperative
 * handlers here on mount and unregisters on unmount. The controller reads from
 * this bridge so it can delegate to the existing implementation without
 * duplicating any generation logic.
 */

export interface OrchestratorBridge {
  /** Navigate to the Orchestrator route. */
  navigate: () => void;

  /**
   * Populate the goal input with a given idea.
   * Calls `onComplete` only after the goal state has been committed.
   */
  populate: (idea: string, onComplete: () => void) => void;

  /**
   * Trigger the full orchestrator generation flow (fetch → SSE stream → project save).
   * The returned Promise resolves only after streaming and saving are complete.
   */
  triggerGenerate: (idea: string) => Promise<void>;

  /**
   * Re-save the current orchestrator output to the active project.
   * No-op if there is no output yet.
   */
  save: () => Promise<void>;

  /** Return the goal text currently held in the input ref. */
  getCurrentIdea: () => string;
}

let _bridge: OrchestratorBridge | null = null;

/** Called by OrchestratorPage on mount to register its handlers. */
export function registerBridge(bridge: OrchestratorBridge): void {
  _bridge = bridge;
}

/** Called by OrchestratorPage on unmount to clean up. */
export function unregisterBridge(): void {
  _bridge = null;
}

/** Read by orchestratorController to call into the page's live handlers. */
export function getBridge(): OrchestratorBridge | null {
  return _bridge;
}
