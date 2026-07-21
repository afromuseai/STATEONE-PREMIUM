// ─── Marcus Event Parser ────────────────────────────────────────────────────────
// Pure TypeScript SSE parser. No React. No DOM. No side effects.
// Splits raw chunks into structured lines. One job.

export interface SseEvent {
  phase: string
  data: Record<string, unknown>
}

export function parseSseBuffer(chunk: string, carry: string): { events: SseEvent[]; carry: string } {
  const buffer = carry + chunk
  const lines = buffer.split("\n")
  const remaining = lines.pop() ?? ""

  const events: SseEvent[] = []

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
    } catch {
      continue
    }
    const phase = parsed.phase as string | undefined
    if (!phase) continue
    events.push({ phase, data: parsed })
  }

  return { events, carry: remaining }
}
