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

// Monotonically increasing counter — each registerBridge call gets a unique ID.
// Used for PROBE logging only. The registration-ID guard is NOT yet applied;
// unregisterBridge always clears the bridge so we can observe the stale-cleanup
// behaviour in runtime logs before deciding to implement the guard.
let _currentRegId = 0;

/** Called by BusinessIntelligencePage on mount to register its handlers. */
export function registerBridge(bridge: IntelligenceBridge): number {
  const id = ++_currentRegId;
  console.log(
    `[PROBE] BI_BRIDGE_REGISTER | registrationId=${id} | bridge=${bridge ? 'INSTANCE' : 'null'}`
  );
  _bridge = bridge;
  return id;
}

/** Called by BusinessIntelligencePage on unmount to clean up. */
export function unregisterBridge(registrationId: number): void {
  const isStale = _currentRegId !== registrationId;
  console.log(
    `[PROBE] BI_BRIDGE_UNREGISTER | registrationId=${registrationId} | currentRegId=${_currentRegId} | ${isStale ? 'CLEARED (stale — would be SKIPPED with guard)' : 'CLEARED'} | caller=useEffect cleanup`
  );
  // NOTE: guard NOT applied — always clears. Probe only.
  _bridge = null;
}

/** Read by intelligenceController to call into the page's live handlers. */
export function getBridge(): IntelligenceBridge | null {
  return _bridge;
}
