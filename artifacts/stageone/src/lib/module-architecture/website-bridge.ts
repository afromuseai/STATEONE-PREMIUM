/**
 * STAGEONE Module Architecture — Website Bridge
 *
 * A singleton bridge between the plain ModuleController and the React component
 * that owns Website Generator state. The Website page registers its imperative
 * handlers here on mount and unregisters on unmount. The controller reads from
 * this bridge so it can delegate to the existing implementation without
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

/** Called by WebsiteGeneratorPage on mount to register its handlers. */
export function registerBridge(bridge: WebsiteBridge): void {
  console.log('[PROBE] WEBSITE_BRIDGE_REGISTER | _bridge was:', _bridge ? 'set' : 'null', '| caller:', new Error().stack?.split('\n')[2]?.trim());
  _bridge = bridge;
}

/** Called by WebsiteGeneratorPage on unmount to clean up. */
export function unregisterBridge(): void {
  console.log('[PROBE] WEBSITE_BRIDGE_UNREGISTER | full stack:\n' + (new Error().stack ?? '(no stack)'));
  _bridge = null;
}

/** Read by websiteController to call into the page's live handlers. */
export function getBridge(): WebsiteBridge | null {
  return _bridge;
}
