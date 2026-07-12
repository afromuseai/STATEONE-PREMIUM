import { useMemo } from "react"
import { RuntimeContext } from "./RuntimeContext"
import { RuntimeEngine } from "../controller/RuntimeEngine"

interface Props {
  children: React.ReactNode
  project?: any
  enabled?: boolean
}

export function RuntimeEngineProvider({
  children,
  project,
  enabled,
}: Props) {
  const engine = useMemo(
    () => new RuntimeEngine(),
    []
  )

  const value = useMemo(
    () => ({
      controller: engine.getRuntime(),
      start: engine.start.bind(engine),
      subscribe: engine.subscribe.bind(engine),
    }),
    [engine]
  )

  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  )
}