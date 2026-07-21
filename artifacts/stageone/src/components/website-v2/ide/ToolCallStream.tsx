// ─── ToolCallStream — Renders streaming tool calls in conversation ────────────

import { useState, useEffect, useRef } from "react"
import { ToolCallCard } from "./ToolCallCard"
import type { ToolCall, ToolResult, TimelineEntry } from "./AgentRuntime"

interface ToolCallStreamProps {
  entries: TimelineEntry[]
  /** Called when user accepts a diff */
  onDiffAccept?: (entryId: string) => void
  /** Called when user rejects a diff */
  onDiffReject?: (entryId: string) => void
  /** Called when user wants to modify a diff */
  onDiffModify?: (entryId: string) => void
}

export function ToolCallStream({
  entries,
  onDiffAccept,
  onDiffReject,
  onDiffModify,
}: ToolCallStreamProps) {
  const [toolCalls, setToolCalls] = useState<Map<string, {
    call: ToolCall
    result?: ToolResult
    status: "running" | "done" | "error"
    entryId: string
  }>>(new Map())

  // Sync tool calls from timeline entries
  useEffect(() => {
    const newCalls = new Map<string, {
      call: ToolCall
      result?: ToolResult
      status: "running" | "done" | "error"
      entryId: string
    }>()

    for (const entry of entries) {
      if (entry.kind === "tool-call") {
        newCalls.set(entry.id, {
          call: { name: entry.name, params: entry.params },
          status: entry.status,
          result: entry.result ? { name: entry.name, params: entry.params, result: entry.result, ok: entry.status === "done" } : undefined,
          entryId: entry.id,
        })
      }
    }

    setToolCalls(newCalls)
  }, [entries])

  // Find diff entries for write_file calls
  const diffEntries = entries.filter((e): e is TimelineEntry & { kind: "file-change"; change: { path: string; operation: "update" | "create" | "delete" } } => 
    e.kind === "file-change" && e.change.operation === "update"
  )

  return (
    <div className="space-y-2">
      {Array.from(toolCalls.values()).map((tc) => {
        const diffEntry = diffEntries.find(d =>
          d.change.path === tc.call.params.path &&
          tc.call.name === "write_file"
        )

        return (
          <ToolCallCard
            key={tc.entryId}
            call={tc.call}
            result={tc.result}
            status={tc.status}
            showDiff={!!diffEntry}
            oldContent={""} // Would need to track this from the agent
            newContent={""}
            onAccept={diffEntry ? () => onDiffAccept?.(diffEntry.id) : undefined}
            onReject={diffEntry ? () => onDiffReject?.(diffEntry.id) : undefined}
            onModify={diffEntry ? () => onDiffModify?.(diffEntry.id) : undefined}
          />
        )
      })}
    </div>
  )
}