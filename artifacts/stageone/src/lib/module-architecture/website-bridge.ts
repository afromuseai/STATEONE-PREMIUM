/**
 * STAGEONE Module Architecture — Website Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Website Studio's generation state. WebsiteStudioCreatePage
 * (src/pages/website-studio-create.tsx) registers its imperative handlers
 * here on mount and unregisters on unmount. The controller reads from this
 * bridge so it can delegate to the existing implementation without
 * duplicating any generation logic.
 *
 * Phase 3 only. No other module uses this file.
 */

export interface WebsiteBridge {
  /** Navigate to the Website Generator route. */
  navigate: () => void;

  /**
   * Start the typewriter populate animation for a given business idea.
   * Calls `onComplete` when the animation finishes (typewriter done, form ready).
   */
  populate: (idea: string, onComplete: () => void) => void;

  /**
   * Trigger the full website generation flow (fetch → SSE stream → project save).
   * The returned Promise resolves only after streaming, saving, and UI update
   * are all complete.
   */
  triggerGenerate: (idea: string) => Promise<void>;

  /**
   * Re-save the current website output to the active project.
   * No-op if there is no output yet.
   */
  save: () => Promise<void>;

  /** Return the business idea currently held in the input ref. */
  getCurrentIdea: () => string;
}

let _bridge: WebsiteBridge | null = null;
// Monotonically increasing counter. Each call to registerBridge gets a unique ID.
// unregisterBridge(id) is a no-op when id !== _currentRegId, which prevents a
// stale cleanup (from a concurrently unmounted duplicate fiber) from nullifying
// the registration of the live instance.
let _currentRegId = 0;

/** Called by WebsiteStudioCreatePage on mount to register its handlers.
 *  Returns a registration ID that must be passed to unregisterBridge(). */
export function registerBridge(bridge: WebsiteBridge): number {
  const id = ++_currentRegId;
  console.log('[PROBE] WEBSITE_BRIDGE_REGISTER | _bridge was:', _bridge ? 'set' : 'null', '| regId:', id, '| caller:', new Error().stack?.split('\n')[2]?.trim());
  _bridge = bridge;
  return id;
}

/** Called by WebsiteStudioCreatePage on unmount to clean up.
 *  Pass the ID returned by registerBridge(). Stale IDs are silently ignored. */
export function unregisterBridge(registrationId: number): void {
  if (_currentRegId !== registrationId) {
    console.log('[PROBE] WEBSITE_BRIDGE_UNREGISTER | SKIPPED stale cleanup | regId:', registrationId, '| currentRegId:', _currentRegId);
    return;
  }
  console.log('[PROBE] WEBSITE_BRIDGE_UNREGISTER | regId:', registrationId, '| caller:', new Error().stack?.split('\n')[2]?.trim());
  _bridge = null;
}

/** Read by websiteController to call into the page's live handlers. */
export function getBridge(): WebsiteBridge | null {
  return _bridge;
}
