// ─── Marcus Session Context ────────────────────────────────────────────────────
// The single runtime that owns all Marcus execution state.
// Every rendering component reads from here. Nothing else owns agent state.

import {
  createContext, useContext, useReducer, useCallback,
  useRef, useEffect, type ReactNode, type Dispatch,
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

// ─── Cross-page persistence ────────────────────────────────────────────────────
// Website Studio's create/generating/workspace views each mount their own
// <MarcusSessionProvider>, so a plain useReducer loses the whole conversation
// and file timeline the instant the user navigates between those pages (the
// chat "disappearing" bug). Mirror state to sessionStorage so a fresh provider
// picks up where the last one left off, for the lifetime of the browser tab.
const STORAGE_KEY = "marcus:session:v1"

function loadPersistedState(): MarcusSessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_SESSION_STATE
    const parsed = JSON.parse(raw) as MarcusSessionState
    // Never resume mid-stream — a hard reload/remount can't re-attach to a
    // live SSE connection, so treat an in-flight or failed generation as stale
    // and discard it entirely instead of showing an unrecoverable error.
    if (parsed.status === "generating" || parsed.status === "failed") {
      sessionStorage.removeItem(STORAGE_KEY)
      return INITIAL_SESSION_STATE
    }
    return parsed
  } catch {
    return INITIAL_SESSION_STATE
  }
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function MarcusSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(marcusSessionReducer, undefined, loadPersistedState)

  useEffect(() => {
    if (state.status === "idle" && state.conversation.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // sessionStorage full or unavailable — persistence is best-effort only
    }
  }, [state])

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

  // Re-entrancy guard: prevents start() from firing a second POST to the
  // server while another is still starting up (rapid clicks, keyboard + button
  // race, etc.). Without this guard each call sends a POST that may create a
  // new project on the server before the abort signal can cancel it.
  const startingRef = useRef(false)

  const start = useCallback(async (
    idea: string,
    businessIntelligence?: Record<string, unknown>,
  ): Promise<string | null> => {
    // Re-entrancy guard — don't send a second POST while one is already
    // starting. The abort in handleRef.current?.cancel() cannot retroactively
    // undo a project the server already created.
    if (startingRef.current) return null
    startingRef.current = true

    try {
      // Cancel any prior in-flight connection.
      handleRef.current?.cancel()

      const handle = MarcusTransport.connect({
        endpoint: "/api/generate/website-v2/stream",
        body: { idea, businessIntelligence },
        dispatch,
      })

      handleRef.current = handle

      const result = await handle.result
      return result.projectId
    } finally {
      startingRef.current = false
    }
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
