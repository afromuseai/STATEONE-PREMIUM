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
// Monotonically increasing counter. Each call to registerBridge gets a unique ID.
// unregisterBridge(id) is a no-op when id !== _currentRegId, which prevents a
// stale cleanup (from a concurrently unmounted duplicate fiber) from nullifying
// the registration of the live instance.
let _currentRegId = 0;

/** Called by OrchestratorPage on mount to register its handlers.
 *  Returns a registration ID that must be passed to unregisterBridge(). */
export function registerBridge(bridge: OrchestratorBridge): number {
  const id = ++_currentRegId;
  _bridge = bridge;
  return id;
}

/** Called by OrchestratorPage on unmount to clean up.
 *  Pass the ID returned by registerBridge(). Stale IDs are silently ignored. */
export function unregisterBridge(registrationId: number): void {
  if (_currentRegId !== registrationId) return;
  _bridge = null;
}

/** Read by orchestratorController to call into the page's live handlers. */
export function getBridge(): OrchestratorBridge | null {
  return _bridge;
}
