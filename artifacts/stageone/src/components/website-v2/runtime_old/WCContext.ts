/**
 * Isolated context creation — kept in its own file so Vite Fast Refresh
 * can hot-swap WebContainerProvider.tsx without a full-page reload.
 * (Mixing a createContext() call with a React component export in the same
 * file triggers the "incompatible export" Fast Refresh warning.)
 */
import { createContext } from "react"
import type { WCContextValue } from "./runtime-types"

const NOOP_CTX: WCContextValue = {
  status:        "idle",
  wcUrl:         null,
  terminalLines: [],
  nodeVersion:   null,
  depCount:      0,
  writeFile:     async () => {},
  writeFileForReview: async () => { throw new Error("WebContainer not ready") },
  readFile:      async () => { throw new Error("WebContainer not ready") },
  listDir:       async () => { throw new Error("WebContainer not ready") },
  runCommand:    async () => { throw new Error("WebContainer not ready") },
  clearTerminal: () => {},
}

export const WCReactContext = createContext<WCContextValue>(NOOP_CTX)
