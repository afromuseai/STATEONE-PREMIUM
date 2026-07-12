import { createContext, useContext } from "react"


export interface RuntimeContextValue {
  controller: any
  start: (files: any, projectId?: string) => Promise<void>
  subscribe: (listener: any) => () => void
}

export const RuntimeContext =
  createContext<RuntimeContextValue | null>(null)
export function useRuntimeContext() {
  const context = useContext(RuntimeContext)

  if (!context) {
    throw new Error(
      "useRuntimeContext must be used inside RuntimeProvider"
    )
  }

  return context
}