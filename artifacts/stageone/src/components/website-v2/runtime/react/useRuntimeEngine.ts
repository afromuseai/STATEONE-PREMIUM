import { useMemo } from "react"
import { RuntimeEngine } from "../controller/RuntimeEngine"

export function useRuntimeEngine() {
  return useMemo(
    () => new RuntimeEngine(),
    []
  )
}