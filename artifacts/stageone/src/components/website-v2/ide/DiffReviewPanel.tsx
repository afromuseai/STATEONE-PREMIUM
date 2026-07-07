// ─── Phase P3 — Diff Review Panel ─────────────────────────────────────────────
// Every AI file change goes through a review gate:
// Shows a unified diff (added/removed lines) with Accept / Reject / Modify.

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Trash2, GitBranch, FileDiff, ChevronDown, ChevronUp } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FileDiff {
  id:         string
  path:       string
  oldContent: string
  newContent: string
  isNew?:     boolean
  reason?:    string
}

// ─── Tiny line-by-line diff algorithm ─────────────────────────────────────────
type DiffLine =
  | { kind: "same";    text: string; lineNo: number }
  | { kind: "removed"; text: string; lineNo: number }
  | { kind: "added";   text: string; lineNo: number }

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText === "" ? [] : oldText.split("\n")
  const newLines = newText.split("\n")

  // Longest Common Subsequence (LCS) to produce minimal diff
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

  // Backtrack
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ kind: "same",    text: oldLines[i - 1], lineNo: i })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ kind: "added",   text: newLines[j - 1], lineNo: j })
      j--
    } else {
      result.unshift({ kind: "removed", text: oldLines[i - 1], lineNo: i })
      i--
    }
  }

  return result
}

// ─── Diff stats ────────────────────────────────────────────────────────────────
function diffStats(lines: DiffLine[]) {
  return {
    added:   lines.filter(l => l.kind === "added").length,
    removed: lines.filter(l => l.kind === "removed").length,
  }
}

// ─── Limit context around hunks (±3 lines like git diff) ──────────────────────
function collapseContext(lines: DiffLine[], context = 3): (DiffLine | "---")[] {
  const CHANGED = new Set(
    lines.map((l, i) => l.kind !== "same" ? i : -1).filter(i => i >= 0)
  )
  const visible = new Set<number>()
  CHANGED.forEach(idx => {
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) {
      visible.add(k)
    }
  })

  const result: (DiffLine | "---")[] = []
  let prevVisible = true
  for (let i = 0; i < lines.length; i++) {
    if (visible.has(i)) {
      if (!prevVisible) result.push("---")
      result.push(lines[i])
      prevVisible = true
    } else {
      prevVisible = false
    }
  }
  return result
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

// ─── Individual diff card ──────────────────────────────────────────────────────
function DiffCard({ diff, expanded, onToggle, onAccept, onReject, onModify }: {
  diff:     FileDiff
  expanded: boolean
  onToggle: () => void
  onAccept: () => void
  onReject: () => void
  onModify: () => void
}) {
  const diffLines = useMemo(() => computeDiff(diff.oldContent, diff.newContent), [diff])
  const collapsed = useMemo(() => collapseContext(diffLines), [diffLines])
  const { added, removed } = diffStats(diffLines)
  const filename = diff.path.split("/").pop() ?? diff.path

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
            <span className="max-w-[200px] truncate font-mono text-[12px] text-white/70">{filename}</span>
            {diff.isNew && (
              <span className="rounded bg-emerald-400/12 px-1 py-px text-[9px] font-semibold uppercase text-emerald-400">new</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {added > 0   && <span className="text-[10px] text-emerald-400">+{added}</span>}
            {removed > 0 && <span className="text-[10px] text-red-400">-{removed}</span>}
            {diff.reason && (
              <span className="truncate text-[10px] text-white/22">{diff.reason}</span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp   className="h-3.5 w-3.5 flex-shrink-0 text-white/20" />
          : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-white/20" />
        }
      </button>

      {/* Diff viewer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 overflow-auto rounded-lg border border-white/[0.06] bg-[#080808]"
              style={{ maxHeight: 260, scrollbarWidth: "thin" }}
            >
              <div className="p-2 font-mono text-[11px] leading-[1.6]">
                {collapsed.map((line, i) => {
                  if (line === "---") {
                    return (
                      <div key={i} className="flex items-center gap-2 py-0.5 text-white/18">
                        <span className="w-6 select-none text-right text-[9px]">···</span>
                        <span className="text-[9px]">···</span>
                      </div>
                    )
                  }
                  const isAdded   = line.kind === "added"
                  const isRemoved = line.kind === "removed"
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-0 rounded px-1 py-px ${
                        isAdded   ? "bg-emerald-500/10" :
                        isRemoved ? "bg-red-500/10"     : ""
                      }`}
                    >
                      <span className={`mr-2 w-5 select-none flex-shrink-0 text-right text-[9px] ${
                        isAdded   ? "text-emerald-400/60" :
                        isRemoved ? "text-red-400/60"     :
                        "text-white/12"
                      }`}>
                        {line.lineNo}
                      </span>
                      <span className={`mr-2 flex-shrink-0 select-none ${
                        isAdded   ? "text-emerald-400" :
                        isRemoved ? "text-red-400"     :
                        "text-white/12"
                      }`}>
                        {isAdded ? "+" : isRemoved ? "-" : " "}
                      </span>
                      <span className={`min-w-0 flex-1 break-all ${
                        isAdded   ? "text-emerald-300/80" :
                        isRemoved ? "text-red-300/60"     :
                        "text-white/40"
                      }`}>
                        {line.text || " "}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                onClick={onAccept}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/12 py-2 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/22 transition-colors"
              >
                <Check className="h-3 w-3" /> Accept
              </button>
              <button
                onClick={onReject}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-2 text-[11px] font-semibold text-red-400 hover:bg-red-500/18 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Reject
              </button>
              <button
                onClick={onModify}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] py-2 text-[11px] text-white/45 hover:bg-white/[0.08] hover:text-white/65 transition-colors"
              >
                Modify
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
