import { useContext } from "react"
import { WCReactContext } from "./WCContext"
import type { WCContextValue } from "./runtime-types"

/**
 * Consume the WebContainer runtime context.
 *
 * Must be used inside a <WebContainerProvider>.
 * Returns a stable no-op context if the provider is absent (graceful fallback).
 */
export function useWebContainer(): WCContextValue {
  return useContext(WCReactContext)
}
