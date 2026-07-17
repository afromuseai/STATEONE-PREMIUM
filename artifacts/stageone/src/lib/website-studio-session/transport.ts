// ─── Website Studio Transport ──────────────────────────────────────────────────
// Owns all networking for the Website Studio session stream.
// No React dependency. No DOM dependency. Pure TypeScript.
//
// Responsibilities:
//   - fetch() with AbortController
//   - ReadableStream reader + TextDecoder
//   - SSE chunk buffering (carry buffer)
//   - Delegates chunk → structured events to parseSseBuffer
//   - Delegates phase name → WSSessionEvent to buildWSEvents
//   - 403 / UPGRADE_REQUIRED detection
//   - Cleanup, cancellation, error dispatch

import { parseWSSseBuffer } from "./parser"
import { buildWSEvents } from "./event-registry"
import type { WSSessionEvent } from "./types"

export interface WSTransportConnectOptions {
  endpoint: string
  body: Record<string, unknown>
  dispatch: (event: WSSessionEvent) => void
  signal?: AbortSignal
}

export interface WSTransportResult {
  projectId: string | null
}

export interface WSTransportHandle {
  cancel: () => void
  result: Promise<WSTransportResult>
}

export const WSTransport = {
  connect(opts: WSTransportConnectOptions): WSTransportHandle {
    const internal = new AbortController()
    const combinedSignal = opts.signal
      ? composeAbortSignals(opts.signal, internal.signal)
      : internal.signal

    const promise = connectInternal(opts, combinedSignal)

    return {
      cancel: () => internal.abort(),
      result: promise,
    }
  },
}

// ─── Internal implementation ─────────────────────────────────────────────────

async function connectInternal(
  opts: WSTransportConnectOptions,
  signal: AbortSignal,
): Promise<WSTransportResult> {
  const { endpoint, body, dispatch } = opts

  dispatch({ type: "session.reset" })

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })

    // ── 403 / UPGRADE_REQUIRED ──────────────────────────────────────────
    if (res.status === 403) {
      const parsed = await res.json().catch(() => ({})) as { error?: string }
      const message =
        parsed.error === "UPGRADE_REQUIRED"
          ? "Upgrade required to use Website Studio"
          : `Access denied (${res.status})`
      dispatch({ type: "session.failed", message })
      return { projectId: null }
    }

    // ── Other HTTP errors ──────────────────────────────────────────────
    if (!res.ok || !res.body) {
      dispatch({ type: "session.failed", message: `HTTP ${res.status}` })
      return { projectId: null }
    }

    // ── Stream reader loop ─────────────────────────────────────────────
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let carry = ""
    let capturedProjectId: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const result = parseWSSseBuffer(chunk, carry)
      carry = result.carry

      for (const sseEvent of result.events) {
        const _trace = typeof window !== 'undefined' ? (window.__TRACE__ || (window.__TRACE__ = [])) : null; _trace?.push({ loc:'transport:sse', phase: sseEvent.phase, dataKeys: Object.keys(sseEvent.data) }); console.log("[TRACE:transport] raw SSE", { phase: sseEvent.phase, data: JSON.stringify(sseEvent.data).slice(0, 300) })
        const built = buildWSEvents(sseEvent.phase, sseEvent.data, capturedProjectId)

        for (const event of built.events) {
          console.log("[TRACE:transport] dispatching", { type: event.type, event: JSON.stringify(event).slice(0, 300) })
          dispatch(event)
        }

        if (built.capturedProjectId) {
          capturedProjectId = built.capturedProjectId
        }

        if (built.terminal === "completed") {
          return { projectId: capturedProjectId }
        }

        if (built.terminal === "failed") {
          const msg = built.errorMessage ?? "Generation failed"
          dispatch({ type: "session.failed", message: msg })
          return { projectId: null }
        }
      }
    }

    // ── Stream ended without an explicit "done"/"error" terminal event ─────────
    // This means the connection was cut (proxy idle timeout, network drop, etc)
    // before Website Studio reported success or failure. The REPORT phase (DB save)
    // happens right before "done" is sent, so an early cutoff means files were
    // very likely NOT persisted — treat this as a failure, never as success,
    // regardless of how many per-file "completed" tool events already streamed.
    dispatch({
      type: "session.failed",
      message: "Connection to Website Studio was interrupted before generation finished — your files were not saved. Please try again.",
    })
    return { projectId: null }
  } catch (err) {
    if ((err as Error).name === "AbortError") return { projectId: null }
    dispatch({
      type: "session.failed",
      message: err instanceof Error ? err.message : "Connection error",
    })
    return { projectId: null }
  }
}

// ─── Utility: compose two AbortSignals into one ──────────────────────────────
// When either signal aborts, the composed signal aborts.
function composeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  const onAbort = () => controller.abort()
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort()
      return controller.signal
    }
    sig.addEventListener("abort", onAbort, { once: true })
  }

  return controller.signal
}