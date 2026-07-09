// ─── Marcus Session Context ────────────────────────────────────────────────────
// The single runtime that owns all Marcus execution state.
// Every rendering component reads from here. Nothing else owns agent state.

import {
  createContext, useContext, useReducer, useCallback,
  useRef, type ReactNode, type Dispatch,
} from "react"
import type { MarcusSessionState, MarcusSessionEvent } from "./types"
import { INITIAL_SESSION_STATE } from "./types"
import { marcusSessionReducer } from "./reducer"

// ─── Context shape ─────────────────────────────────────────────────────────────
interface MarcusSessionContextValue {
  state:    MarcusSessionState
  dispatch: Dispatch<MarcusSessionEvent>
}

const MarcusSessionContext = createContext<MarcusSessionContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────────
export function MarcusSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(marcusSessionReducer, INITIAL_SESSION_STATE)

  return (
    <MarcusSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </MarcusSessionContext.Provider>
  )
}

// ─── Primary hook — full session state + dispatch ─────────────────────────────
export function useMarcusSessionContext() {
  const ctx = useContext(MarcusSessionContext)
  if (!ctx) throw new Error("useMarcusSessionContext must be used inside MarcusSessionProvider")
  return ctx
}

// ─── Selector hook — derive a slice of session state ─────────────────────────
// Use this in rendering components so they only re-render when their slice changes.
export function useMarcusSessionSelector<T>(select: (s: MarcusSessionState) => T): T {
  const { state } = useMarcusSessionContext()
  return select(state)
}

// ─── SSE reader hook ──────────────────────────────────────────────────────────
// Connects to the Marcus session stream, dispatches typed events.
// Delegates all networking and parsing to MarcusTransport.
import { MarcusTransport, type MarcusTransportHandle } from "./transport"

export function useMarcusSessionStream() {
  const { dispatch } = useMarcusSessionContext()
  const handleRef = useRef<MarcusTransportHandle | null>(null)

  const start = useCallback(async (
    idea: string,
    businessIntelligence?: Record<string, unknown>,
  ): Promise<string | null> => {
    handleRef.current?.cancel()

    const handle = MarcusTransport.connect({
      endpoint: "/api/generate/website-v2/stream",
      body: { idea, businessIntelligence },
      dispatch,
    })

    handleRef.current = handle

    const result = await handle.result
    return result.projectId
  }, [dispatch])

  const cancel = useCallback(() => {
    handleRef.current?.cancel()
  }, [])

  return { start, cancel }
}

// ─── Optional context hook — safe to call outside a provider ─────────────────
// Returns null instead of throwing. Use in components that opt into the session
// runtime without requiring it (e.g. AgentPanel in both workspace and creation).
export function useOptionalMarcusSession(): MarcusSessionContextValue | null {
  return useContext(MarcusSessionContext)
}

// No compat re-exports — StreamGenerationScreen now reads MarcusSessionState directly.
