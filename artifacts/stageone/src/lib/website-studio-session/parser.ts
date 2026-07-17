// ─── Website Studio Event Parser ──────────────────────────────────────────────
// Pure TypeScript SSE parser. No React. No DOM. No side effects.
// Splits raw chunks into structured lines. One job.

export interface WSSseEvent {
  phase: string
  data: Record<string, unknown>
}

export function parseWSSseBuffer(chunk: string, carry: string): { events: WSSseEvent[]; carry: string } {
  const buffer = carry + chunk
  const lines = buffer.split("\n")
  const remaining = lines.pop() ?? ""

  const events: WSSseEvent[] = []

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
    console.log("[TRACE:parser] parsed SSE line", { phase, dataKeys: Object.keys(parsed), hasUserMessage: 'userMessage' in parsed || 'user_prompt' in parsed || 'prompt' in parsed || 'idea' in parsed })
    events.push({ phase, data: parsed })
  }

  return { events, carry: remaining }
}