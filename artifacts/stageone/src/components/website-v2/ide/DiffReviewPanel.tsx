// ─── Phase P3 — Diff Review Panel ─────────────────────────────────────────────
// Every AI file change goes through a review gate:
// Shows a side-by-side diff (Monaco diff editor) with inline Accept / Reject per hunk.

import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Trash2, GitBranch, FileDiff, ChevronDown, ChevronUp, Maximize2 } from "lucide-react"
import Editor from "@monaco-editor/react"
import * as monaco from "monaco-editor"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FileDiff {
  id:         string
  path:       string
  oldContent: string
  newContent: string
  isNew?:     boolean
  reason?:    string
}

interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines:    Array<{ type: "same" | "added" | "removed"; text: string; oldLine?: number; newLine?: number }>
}

// ─── Line-by-line diff algorithm (produces unified diff hunks) ─────────────────
function computeDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText === "" ? [] : oldText.split("\n")
  const newLines = newText.split("\n")

  const m = oldLines.length
  const n = newLines.length

  // dp[i][j] = LCS length of oldLines[0..i-1] and newLines[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to get the diff
  const diff: Array<{ type: "same" | "added" | "removed"; text: string; oldLine?: number; newLine?: number }> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: "same", text: oldLines[i - 1], oldLine: i, newLine: j })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "added", text: newLines[j - 1], newLine: j })
      j--
    } else {
      diff.unshift({ type: "removed", text: oldLines[i - 1], oldLine: i })
      i--
    }
  }

  // Group into hunks (context = 3 lines)
  const hunks: DiffHunk[] = []
  const CHANGED = new Set(diff.map((d, idx) => d.type !== "same" ? idx : -1).filter(idx => idx >= 0))
  const visible = new Set<number>()
  CHANGED.forEach(idx => {
    for (let k = Math.max(0, idx - 3); k <= Math.min(diff.length - 1, idx + 3); k++) visible.add(k)
  })

  const sorted = Array.from(visible).sort((a, b) => a - b)
  let currentHunk: DiffHunk | null = null
  let prevIdx = -2
  sorted.forEach(idx => {
    if (idx > prevIdx + 1) {
      // Start new hunk
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = { oldStart: idx, oldLines: 0, newStart: idx, newLines: 0, lines: [] }
    }
    if (currentHunk) {
      const d = diff[idx]
      currentHunk.lines.push({ type: d.type, text: d.text, oldLine: d.oldLine, newLine: d.newLine })
      if (d.type === "same" || d.type === "removed") currentHunk.oldLines++
      if (d.type === "same" || d.type === "added") currentHunk.newLines++
      if (!currentHunk.oldStart) currentHunk.oldStart = idx
      if (!currentHunk.newStart) currentHunk.newStart = idx
    }
    prevIdx = idx
  })
  if (currentHunk) hunks.push(currentHunk)

  // Adjust start positions
  hunks.forEach(h => {
    const firstLine = h.lines[0]
    h.oldStart = firstLine.oldLine ?? 1
    h.newStart = firstLine.newLine ?? 1
  })

  return hunks
}

// ─── Component ────────────────────────────────────────────────────────────────
interface DiffReviewPanelProps {
  diffs:    FileDiff[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onModify: (diff: FileDiff) => void
  onClear:  () => void
}

export function DiffReviewPanel({ diffs, onAccept, onReject, onModify, onClear }: DiffReviewPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(diffs[0]?.id ?? null)
  const [hunkDecisions, setHunkDecisions] = useState<Map<string, Map<number, "accept" | "reject" | "pending">>>(new Map())

  const handleHunkDecision = (diffId: string, hunkIdx: number, decision: "accept" | "reject" | "pending") => {
    setHunkDecisions(prev => {
      const next = new Map(prev)
      const diffMap = new Map(next.get(diffId) ?? [])
      diffMap.set(hunkIdx, decision)
      next.set(diffId, diffMap)
      return next
    })
  }

  if (diffs.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f0f0f] shadow-2xl shadow-black/70"
      style={{ width: 420, maxHeight: "80vh" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/12">
          <FileDiff className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <div className="flex-1">
          <span className="text-[13px] font-semibold text-white/80">Diff Review</span>
          <span className="ml-2 rounded bg-amber-400/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            {diffs.length} change{diffs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={onClear} className="text-white/20 hover:text-white/50 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Diffs list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {diffs.map(diff => (
          <DiffCard
            key={diff.id}
            diff={diff}
            expanded={expandedId === diff.id}
            onToggle={() => setExpandedId(expandedId === diff.id ? null : diff.id)}
            onAccept={() => onAccept(diff.id)}
            onReject={() => onReject(diff.id)}
            onModify={() => onModify(diff)}
            hunkDecisions={hunkDecisions.get(diff.id)}
            onHunkDecision={(hunkIdx, decision) => handleHunkDecision(diff.id, hunkIdx, decision)}
          />
        ))}
      </div>

      {/* Batch actions */}
      {diffs.length > 1 && (
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-2">
          <span className="flex-1 text-[11px] text-white/28">Accept or reject all changes</span>
          <button
            onClick={() => diffs.forEach(d => onAccept(d.id))}
            className="flex items-center gap-1 rounded-md bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="h-3 w-3" /> Accept all
          </button>
          <button
            onClick={() => diffs.forEach(d => onReject(d.id))}
            className="flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/18 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Reject all
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Individual diff card with Monaco diff editor ──────────────────────────────
interface DiffCardProps {
  diff:           FileDiff
  expanded:       boolean
  onToggle:       () => void
  onAccept:       () => void
  onReject:       () => void
  onModify:       () => void
  hunkDecisions?: Map<number, "accept" | "reject" | "pending">
  onHunkDecision: (hunkIdx: number, decision: "accept" | "reject" | "pending") => void
}

function DiffCard({ diff, expanded, onToggle, onAccept, onReject, onModify, hunkDecisions, onHunkDecision }: DiffCardProps) {
  const editorRef = useRef<{ editor: monaco.editor.IStandaloneCodeEditor } | null>(null)
  const [hunks, setHunks] = useState<DiffHunk[]>([])
  const [mounted, setMounted] = useState(false)

  // Compute diff hunks when diff changes
  useEffect(() => {
    const computed = computeDiff(diff.oldContent, diff.newContent)
    setHunks(computed)
    // Initialize decisions
    if (hunkDecisions && hunkDecisions.size !== computed.length) {
      const initial = new Map<number, "accept" | "reject" | "pending">()
      computed.forEach((_, idx) => initial.set(idx, hunkDecisions.get(idx) ?? "pending"))
      if (onHunkDecision) {
        // sync initial state
        computed.forEach((_, idx) => {
          if (!hunkDecisions.has(idx)) onHunkDecision(idx, "pending")
        })
      }
    }
  }, [diff.oldContent, diff.newContent])

  // Apply hunk decisions to get final content
  const getFinalContent = useMemo(() => {
    if (!hunkDecisions || hunks.length === 0) return diff.newContent
    const oldLines = diff.oldContent === "" ? [] : diff.oldContent.split("\n")
    const newLines = diff.newContent.split("\n")
    let oldIdx = 0, newIdx = 0
    const result: string[] = []

    hunks.forEach((hunk, hunkIdx) => {
      const decision = hunkDecisions.get(hunkIdx) ?? "pending"
      if (decision === "reject") {
        // Use old content for this hunk
        hunk.lines.forEach(line => {
          if (line.type === "same" || line.type === "removed") {
            if (line.oldLine !== undefined) result.push(oldLines[line.oldLine - 1])
          }
        })
      } else {
        // Use new content (accept or pending)
        hunk.lines.forEach(line => {
          if (line.type === "same" || line.type === "added") {
            if (line.newLine !== undefined) result.push(newLines[line.newLine - 1])
          }
        })
      }
    })

    // Add any remaining lines after last hunk
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] === newLines[newIdx]) {
        result.push(oldLines[oldIdx])
        oldIdx++; newIdx++
      } else if (newIdx < newLines.length) {
        result.push(newLines[newIdx])
        newIdx++
      } else {
        oldIdx++
      }
    }

    return result.join("\n")
  }, [diff.oldContent, diff.newContent, hunks, hunkDecisions])

  const handleEditorMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: any) => {
    if (!editorRef.current) {
      editorRef.current = { editor }
      setMounted(true)
    }
  }

  const filename = diff.path.split("/").pop() ?? diff.path
  const stats = useMemo(() => {
    let added = 0, removed = 0
    hunks.forEach(h => {
      h.lines.forEach(l => {
        if (l.type === "added") added++
        else if (l.type === "removed") removed++
      })
    })
    return { added, removed }
  }, [hunks])

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      {/* Card header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-white/25" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="max-w-[220px] truncate font-mono text-[12px] text-white/70">{filename}</span>
            {diff.isNew && (
              <span className="rounded bg-emerald-400/12 px-1 py-px text-[9px] font-semibold uppercase text-emerald-400">new</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {stats.added > 0   && <span className="text-[10px] text-emerald-400">+{stats.added}</span>}
            {stats.removed > 0 && <span className="text-[10px] text-red-400">-{stats.removed}</span>}
            {diff.reason && (
              <span className="truncate text-[10px] text-white/22">{diff.reason}</span>
            )}
            {mounted && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-white/20">
                {Array.from(hunkDecisions?.values() ?? []).filter(d => d === "accept").length} / {hunks.length} accepted
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-white/20" /> : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-white/20" />}
      </button>

      {/* Diff viewer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-white/[0.06] bg-[#080808]"
              style={{ minHeight: 300, maxHeight: 400 }}
            >
              {mounted && (
                <Editor
                  height="100%"
                  language="typescript"
                  theme="vs-dark"
                  value={getFinalContent}
                  options={{
                    readOnly: true,
                    scrollBeyondLastLine: false,
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    renderLineHighlight: "line",
                    fontSize: 12,
                    lineHeight: 1.6,
                    wordWrap: "on",
                    overviewRulerLanes: 0,
                    scrollbar: { vertical: "auto", horizontal: "auto" },
                    glyphMargin: false,
                    folding: false,
                    matchBrackets: "never",
                    renderControlCharacters: false,
                    renderWhitespace: "none",
                  }}
                  onMount={handleEditorMount}
                  className="h-full w-full"
                />
              )}
            </div>

            {/* Hunk-level action bar */}
            {mounted && hunks.length > 0 && (
              <div className="flex items-center gap-2 px-3 pb-3 border-t border-white/[0.05]">
                <span className="flex-1 text-[11px] text-white/30">
                  {Array.from(hunkDecisions?.values() ?? []).filter(d => d === "accept").length} / {hunks.length} hunks accepted
                </span>
                <button
                  onClick={() => {
                    hunks.forEach((_, idx) => onHunkDecision?.(idx, "accept"))
                    setTimeout(onAccept, 100)
                  }}
                  className="flex items-center gap-1 rounded-md bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Check className="h-3 w-3" /> Accept All Hunks
                </button>
                <button
                  onClick={() => {
                    hunks.forEach((_, idx) => onHunkDecision?.(idx, "reject"))
                    setTimeout(onReject, 100)
                  }}
                  className="flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/18 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Reject All Hunks
                </button>
              </div>
            )}

            {/* Per-hunk inline actions (shown in editor via decorations would be ideal, but for now batch actions) */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Side-by-side diff view (alternative: use Monaco's built-in diff editor) ─────
// For a true side-by-side diff editor like Cursor, we'd use monaco.editor.createDiffEditor
// but the inline diff above with per-hunk decisions is closer to the spec.