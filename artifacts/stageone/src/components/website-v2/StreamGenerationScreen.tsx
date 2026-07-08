// ─── Marcus Stream Generation Screen ──────────────────────────────────────────
// Replit-style generation UI: agent thinking on the left, Monaco code streaming
// on the right. Files appear token-by-token as Marcus writes them.

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileCode, CheckCircle2, Loader2, AlertCircle,
  ChevronRight, Sparkles, Terminal, X,
} from "lucide-react"
import Editor, { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import type { GenerationState } from "@/hooks/useMarcusStreamGeneration"

loader.config({ monaco })

// ─── Language → Monaco language id ────────────────────────────────────────────
function toMonacoLang(lang: string): string {
  switch (lang) {
    case "typescript": return "typescript"
    case "css":        return "css"
    case "json":       return "json"
    case "markdown":   return "markdown"
    default:           return "typescript"
  }
}

// ─── File extension → icon color ──────────────────────────────────────────────
function fileColor(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "#7dd3fc"
  if (path.endsWith(".css"))  return "#818cf8"
  if (path.endsWith(".json")) return "#fbbf24"
  return "#9ca3af"
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface StreamGenerationScreenProps {
  state:     GenerationState
  onCancel?: () => void
}

// ─── Thinking text display (auto-scroll) ──────────────────────────────────────
function ThinkingPanel({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [text])

  // Split into paragraphs for nicer display
  const paragraphs = text.split("\n\n").filter(p => p.trim())

  return (
    <div
      ref={ref}
      className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-3"
    >
      {paragraphs.map((p, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm leading-relaxed text-white/60 whitespace-pre-wrap"
        >
          {p}
        </motion.p>
      ))}
      {/* Cursor blink at end */}
      <span className="inline-block h-3.5 w-0.5 animate-pulse bg-amber-400/70 rounded-sm" />
    </div>
  )
}

// ─── File list item ────────────────────────────────────────────────────────────
function FileItem({
  path,
  done,
  active,
}: { path: string; done: boolean; active: boolean }) {
  const name   = path.split("/").pop() ?? path
  const dir    = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : ""
  const color  = fileColor(path)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
        active ? "bg-white/[0.04] border-l-2 border-amber-400/70" : "border-l-2 border-transparent"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
      ) : active ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
      ) : (
        <FileCode className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      )}
      <span className="truncate">
        {dir && <span className="text-white/25">{dir}</span>}
        <span style={{ color: done ? "#6ee7b7" : active ? "#fbbf24" : color }}>{name}</span>
      </span>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function StreamGenerationScreen({ state, onCancel }: StreamGenerationScreenProps) {
  const {
    status, thinkingText, files, activeFilePath,
    activeFileContent, activeFileLanguage, error, fileCount,
  } = state

  // Which tab to show in the right pane
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Auto-select the active file when it changes
  useEffect(() => {
    if (activeFilePath) setSelectedPath(activeFilePath)
  }, [activeFilePath])

  // When a file finishes, keep it selected
  const displayPath    = selectedPath ?? activeFilePath
  const selectedFile   = files.find(f => f.path === displayPath)
  const isActiveFile   = displayPath === activeFilePath
  const displayContent = isActiveFile ? activeFileContent : (selectedFile?.content ?? "")
  const displayLang    = isActiveFile ? activeFileLanguage : (selectedFile?.language ?? "typescript")

  const allFilePaths = [
    ...files.map(f => f.path),
    ...(activeFilePath && !files.find(f => f.path === activeFilePath) ? [activeFilePath] : []),
  ]

  const statusLabel = {
    idle:       "Idle",
    connecting: "Connecting…",
    thinking:   "Marcus is thinking…",
    writing:    activeFilePath ? `Writing ${activeFilePath.split("/").pop()}…` : "Writing…",
    saving:     "Saving to database…",
    done:       "Generation complete",
    error:      "Error",
  }[status] ?? status

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#080808]">

      {/* ── Left panel: Marcus thinking + file list ──────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col border-r border-white/[0.06]">

        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/80">Marcus</p>
            <p className="truncate text-[10px] text-white/35">{statusLabel}</p>
          </div>
          {onCancel && status !== "done" && status !== "error" && (
            <button
              onClick={onCancel}
              className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Thinking text */}
        {(status === "thinking" || status === "writing" || thinkingText) && (
          <div className="flex max-h-64 min-h-0 shrink-0 flex-col border-b border-white/[0.06]">
            <div className="flex items-center gap-2 px-4 py-2">
              <Terminal className="h-3 w-3 text-white/20" />
              <span className="text-[10px] uppercase tracking-wider text-white/20">Thinking</span>
            </div>
            <ThinkingPanel text={thinkingText} />
          </div>
        )}

        {/* File list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {allFilePaths.length > 0 && (
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
              <FileCode className="h-3 w-3 text-white/20" />
              <span className="text-[10px] uppercase tracking-wider text-white/20">
                Files {fileCount > 0 ? `(${fileCount} done)` : ""}
              </span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto py-1">
            {allFilePaths.map(path => (
              <button
                key={path}
                onClick={() => setSelectedPath(path)}
                className="w-full text-left"
              >
                <FileItem
                  path={path}
                  done={!!files.find(f => f.path === path)}
                  active={path === activeFilePath}
                />
              </button>
            ))}
            {allFilePaths.length === 0 && status !== "error" && (
              <div className="flex h-24 items-center justify-center">
                <div className="flex items-center gap-2 text-white/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Waiting for Marcus…</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {status === "error" && error && (
          <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Done banner */}
        {status === "done" && (
          <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-medium text-emerald-400">
                {fileCount} file{fileCount !== 1 ? "s" : ""} generated
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: Monaco code streaming ───────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* File tab bar */}
        <div className="flex min-h-0 shrink-0 items-center gap-0 border-b border-white/[0.06] overflow-x-auto">
          {allFilePaths.length === 0 ? (
            <div className="flex h-9 items-center px-4">
              <span className="text-xs text-white/20">No files yet</span>
            </div>
          ) : (
            allFilePaths.map(path => {
              const name  = path.split("/").pop() ?? path
              const color = fileColor(path)
              const isActive = path === displayPath
              const isDone   = !!files.find(f => f.path === path)
              return (
                <button
                  key={path}
                  onClick={() => setSelectedPath(path)}
                  className={`flex items-center gap-1.5 shrink-0 border-r border-white/[0.06] px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-white/[0.04] text-white/80"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {path === activeFilePath ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />
                  ) : isDone ? (
                    <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
                  ) : (
                    <div className="h-2 w-2 rounded-full" style={{ background: color + "60" }} />
                  )}
                  {name}
                </button>
              )
            })
          )}
        </div>

        {/* Monaco editor — streams tokens */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {displayContent || displayPath ? (
            <Editor
              key={displayPath ?? "empty"}
              language={toMonacoLang(displayLang)}
              value={displayContent}
              theme="vs-dark"
              options={{
                readOnly:           true,
                minimap:            { enabled: false },
                scrollBeyondLastLine: false,
                fontSize:           12,
                lineNumbers:        "on",
                wordWrap:           "on",
                folding:            false,
                renderLineHighlight: "none",
                scrollbar:          { vertical: "auto", horizontal: "auto" },
                padding:            { top: 16, bottom: 16 },
                fontFamily:         "JetBrains Mono, Fira Code, monospace",
                contextmenu:        false,
                quickSuggestions:   false,
                parameterHints:     { enabled: false },
                suggestOnTriggerCharacters: false,
              }}
              // Auto-scroll to bottom as tokens arrive
              onMount={(editor) => {
                const model = editor.getModel()
                if (model) {
                  const disposable = model.onDidChangeContent(() => {
                    const lineCount = model.getLineCount()
                    editor.revealLine(lineCount, 1)
                  })
                  return () => disposable.dispose()
                }
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <Sparkles className="h-5 w-5 text-amber-400/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/40">Marcus is generating your website</p>
                  <p className="mt-1 text-xs text-white/20">Files will appear here as they're written</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "0ms" }} />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "150ms" }} />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
