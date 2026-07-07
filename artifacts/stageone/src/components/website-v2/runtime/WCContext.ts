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
  clearTerminal: () => {},
}

export const WCReactContext = createContext<WCContextValue>(NOOP_CTX)
