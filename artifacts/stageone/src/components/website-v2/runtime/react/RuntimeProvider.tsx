import { useMemo } from "react"
import { RuntimeContext } from "./RuntimeContext"
import { RuntimeController } from "../controller/RuntimeController"
import { RuntimeEngine } from "../controller/RuntimeEngine"

interface Props {
  children: React.ReactNode
}

export function RuntimeProvider({ children }: Props) {
  const runtime = useMemo(() => {
    const engine = new RuntimeEngine()

    return {
      controller: engine.getRuntime(),
      start: engine.start.bind(engine),
      subscribe: engine.subscribe.bind(engine),
    }
  }, [])

  return (
    <RuntimeContext.Provider value={runtime as any}>
      {children}
    </RuntimeContext.Provider>
  )
}