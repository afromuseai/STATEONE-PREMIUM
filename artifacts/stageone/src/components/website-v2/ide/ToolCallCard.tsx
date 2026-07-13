// ─── ToolCallCard — Individual tool call with params/result/diff ───────────────

import { useState } from "react"
import { motion } from "framer-motion"
import {
  FileCode, FileEdit, FolderOpen, Search, Terminal,
  CheckCircle, AlertCircle, Loader2, ChevronDown, Copy, Check, X,
} from "lucide-react"
import type { ToolCall, ToolResult } from "./AgentRuntime"

const TOOL_LABELS: Record<string, string> = {
  read_file:    "Reading file",
  write_file:   "Writing file",
  list_dir:     "Listing directory",
  search_code:  "Searching code",
  run_command:  "Running command",
  done:         "Done",
}

const TOOL_COLORS: Record<string, string> = {
  read_file:    "#818cf8",
  write_file:   "#f59e0b",
  list_dir:     "#6ee7b7",
  search_code:  "#a78bfa",
  run_command:  "#38bdf8",
  done:         "#10b981",
}

const OP_COLORS: Record<string, string> = {
  update: "#60a5fa",
  create: "#34d399",
  delete: "#f87171",
}

interface ToolCallCardProps {
  call: ToolCall
  result?: ToolResult
  status: "running" | "done" | "error"
  /** For write_file: show diff preview with accept/reject */
  showDiff?: boolean
  oldContent?: string
  newContent?: string
  onAccept?: () => void
  onReject?: () => void
  onModify?: () => void
}

export function ToolCallCard({
  call,
  result,
  status,
  showDiff,
  oldContent,
  newContent,
  onAccept,
  onReject,
  onModify,
}: ToolCallCardProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const label = TOOL_LABELS[call.name] || call.name
  const color = TOOL_COLORS[call.name] || "#9ca3af"
  const isWrite = call.name === "write_file"

  const copyResult = () => {
    if (!result) return
    navigator.clipboard.writeText(result.result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const paramsStr = JSON.stringify(call.params, null, 2)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        borderColor: status === "running"
          ? [color + "20", color + "50", color + "20"]
          : "rgba(255, 255, 255, 0.06)",
      }}
      transition={status === "running"
        ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
        : { duration: 0.3 }}
      className="relative overflow-hidden rounded-lg border bg-[#1A1A1A] p-3"
      style={{ borderColor: status === "running" ? color + "30" : "rgba(255,255,255,0.06)" }}
    >
      {/* Shimmer line during execution */}
      {status === "running" && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
          style={{ background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)` }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded" style={{ background: `${color}1a` }}>
          {status === "running" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-3 w-3" style={{ color }} />
            </motion.div>
          ) : status === "error" ? (
            <AlertCircle className="h-3 w-3" style={{ color }} />
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <CheckCircle className="h-3 w-3" style={{ color }} />
            </motion.div>
          )}
        </div>
        <span className="font-mono text-[11px] font-medium text-[#ECECEC]">{label}</span>
        {typeof call.params.path === "string" && (
          <span className="truncate font-mono text-[9px] text-[#ECECEC]/22">
            {String(call.params.path).split("/").pop()}
          </span>
        )}
      </div>

      {/* Params */}
      {Object.keys(call.params).length > 0 && (
        <details className="mb-2 group" open={expanded}>
          <summary className="flex items-center gap-1 cursor-pointer text-[10px] text-[#ECECEC]/30 hover:text-[#ECECEC]/50">
            <span>Params</span>
            <ChevronDown className="h-2.5 w-2.5 transition-transform group-open:rotate-180" />
          </summary>
          <pre className="mt-1.5 rounded bg-[#202020] p-2 text-[9px] text-[#ECECEC]/50 overflow-x-auto">
            {paramsStr}
          </pre>
        </details>
      )}

      {/* Result */}
      {result && status !== "running" && (
        <details className="mb-2 group" open={expanded}>
          <summary className="flex items-center gap-1 cursor-pointer text-[10px] text-[#ECECEC]/30 hover:text-[#ECECEC]/50">
            <span>{status === "error" ? "Error" : "Result"}</span>
            <ChevronDown className="h-2.5 w-2.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-1.5 flex items-center gap-1.5">
            <pre className="flex-1 min-w-0 rounded bg-[#202020] p-2 text-[9px] text-[#ECECEC]/50 overflow-x-auto max-h-40">
              {result.result}
            </pre>
            <button
              onClick={copyResult}
              className="flex-shrink-0 rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[9px] text-[#ECECEC]/28 transition-all hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC]/60"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </details>
      )}

      {/* Diff preview for write_file */}
      {showDiff && isWrite && (oldContent || newContent) && (
        <div className="mt-2 border-t border-[rgba(255,255,255,0.08)] pt-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-medium text-[#ECECEC]/50">Diff Preview</span>
            <span className="rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide"
              style={{ background: `${OP_COLORS.create}15`, color: OP_COLORS.create }}
            >
              {oldContent ? "update" : "create"}
            </span>
          </div>
          <div className="rounded bg-[#202020] p-2 text-[9px] font-mono overflow-x-auto max-h-48">
            <pre>{generateDiff(oldContent ?? "", newContent ?? "")}</pre>
          </div>
          {onAccept && onReject && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={onAccept}
                className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                <Check className="h-3 w-3" /> Accept
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-1 rounded-md bg-red-500/20 px-2.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
              >
                <X className="h-3 w-3" /> Reject
              </button>
              {onModify && (
                <button
                  onClick={onModify}
                  className="flex items-center gap-1 rounded-md bg-[#252525] px-2.5 py-1 text-[10px] text-[#ECECEC]/35 hover:bg-[#252525] transition-colors"
                >
                  Modify
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// Simple diff generator
function generateDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split("\n")
  const newLines = newStr.split("\n")
  const maxLines = Math.max(oldLines.length, newLines.length)
  let diff = ""

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine === newLine) {
      diff += `  ${oldLine ?? ""}\n`
    } else if (oldLine !== undefined && newLine === undefined) {
      diff += `- ${oldLine}\n`
    } else if (oldLine === undefined && newLine !== undefined) {
      diff += `+ ${newLine}\n`
    } else {
      diff += `- ${oldLine}\n+ ${newLine}\n`
    }
  }

  return diff
}