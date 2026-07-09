// ─── Marcus Transport ───────────────────────────────────────────────────────────
// Owns all networking for the Marcus session stream.
// No React dependency. No DOM dependency. Pure TypeScript.
//
// Responsibilities:
//   - fetch() with AbortController
//   - ReadableStream reader + TextDecoder
//   - SSE chunk buffering (carry buffer)
//   - Delegates chunk → structured events to parseSseBuffer
//   - Delegates phase name → MarcusSessionEvent to buildEvents
//   - 403 / UPGRADE_REQUIRED detection
//   - Cleanup, cancellation, error dispatch

import { parseSseBuffer } from "./parser"
import { buildEvents } from "./event-registry"
import type { MarcusSessionEvent } from "./types"

export interface MarcusTransportConnectOptions {
  endpoint: string
  body: Record<string, unknown>
  dispatch: (event: MarcusSessionEvent) => void
  signal?: AbortSignal
}

export interface MarcusTransportResult {
  projectId: string | null
}

export interface MarcusTransportHandle {
  cancel: () => void
  result: Promise<MarcusTransportResult>
}

export const MarcusTransport = {
  connect(opts: MarcusTransportConnectOptions): MarcusTransportHandle {
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
  opts: MarcusTransportConnectOptions,
  signal: AbortSignal,
): Promise<MarcusTransportResult> {
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
      const result = parseSseBuffer(chunk, carry)
      carry = result.carry

      for (const sseEvent of result.events) {
        const built = buildEvents(sseEvent.phase, sseEvent.data, capturedProjectId)

        for (const event of built.events) {
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

    // ── Stream ended without explicit completion ──────────────────────
    if (capturedProjectId) {
      dispatch({ type: "session.completed", projectId: capturedProjectId, fileCount: 0 })
      return { projectId: capturedProjectId }
    }

    dispatch({ type: "session.failed", message: "Stream ended without completing" })
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
