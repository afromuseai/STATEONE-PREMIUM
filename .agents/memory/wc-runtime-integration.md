---
name: WebContainer Runtime Integration
description: Phase N — WC provider singleton pattern, Fast Refresh context split, Monaco debounce cleanup, Marcus-sync diffing
---

## Singleton / boot-promise pattern

`WebContainer.boot()` must only be called once per browser tab. The provider uses three module-level variables to enforce this across React remounts and StrictMode double-invoke:

- `wcSingleton: WCType | null` — the booted instance; set once, never replaced
- `bootPromise: Promise<WCType> | null` — the in-flight or settled boot promise; concurrent mounts `await` this instead of calling `boot()` again; set to `null` only if boot fails (to allow retry)
- `pipelineComplete: boolean` — true once mount→install→dev all succeed; remounts skip the heavy pipeline and restore state immediately

**Why:** A component-local `bootingRef` can't protect against concurrent mount A + mount B racing the module-level singleton. The promise is the correct synchronisation primitive.

## Fast Refresh: separate context file

Exporting `createContext()` results and React components from the same `.tsx` file triggers Vite's "incompatible export" Fast Refresh warning and causes full-page reloads instead of HMR.

**Fix:** Move `createContext()` to a standalone `.ts` file (`WCContext.ts`). Both the provider and the consumer hook import from it.

Files:
- `runtime/WCContext.ts` — just the context object + no-op default
- `runtime/WebContainerProvider.tsx` — imports from WCContext; exports only the provider component
- `runtime/useWebContainer.ts` — imports from WCContext; exports only the hook

## Monaco debounce cleanup

`CodeEditor` debounces `onChange → wc.fs.writeFile()` with a 400ms timer stored in `debounceRef`. The timer must be cleared on unmount/file-switch to prevent stale writes after teardown.

**Fix:** `useEffect(() => () => { clearTimeout(debounceRef.current) }, [])` — stable empty-dep cleanup.

## Marcus → WC FS sync (N5)

After Marcus edits files and `onRefresh()` updates `project.files`, the provider's `useEffect([project.files])` diffs against `syncedFilesRef` (a `Map<path, content>`) and calls `wc.fs.writeFile()` only for changed/new files.

**No infinite loop risk:** `syncedFilesRef` is updated synchronously after each write, so the same content can never re-trigger the effect.

**How to apply:** `syncedFilesRef` is populated on initial mount and updated in both the boot-effect (after `wc.mount()`) and the sync-effect. Always keep the two maps in sync.
