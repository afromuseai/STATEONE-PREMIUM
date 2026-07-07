import { useRef, useEffect } from "react"
import Editor, { loader, type OnMount } from "@monaco-editor/react"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// Use the locally-installed monaco-editor package instead of CDN.
// This avoids cross-origin worker failures under the COOP/COEP headers
// set in vite.config.ts for WebContainer SharedArrayBuffer support.
import * as monaco from "monaco-editor"
loader.config({ monaco })

// ─── Language detection ────────────────────────────────────────────────────────
function detectLanguage(file: V2ProjectFile): string {
  if (file.language) {
    // normalise server-provided language names
    const l = file.language.toLowerCase()
    if (l === "typescript" || l === "ts") return "typescript"
    if (l === "tsx" || l === "typescriptreact") return "typescript"
    if (l === "javascript" || l === "js") return "javascript"
    if (l === "jsx" || l === "javascriptreact") return "javascript"
    if (l === "css") return "css"
    if (l === "html") return "html"
    if (l === "json") return "json"
    if (l === "markdown" || l === "md") return "markdown"
    return l
  }
  const ext = file.path.split(".").pop()?.toLowerCase() ?? ""
  const MAP: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    css: "css", scss: "scss",
    html: "html", json: "json",
    md: "markdown", mdx: "markdown",
    py: "python", sh: "shell",
    yaml: "yaml", yml: "yaml",
  }
  return MAP[ext] ?? "plaintext"
}

// ─── Monaco editor options ─────────────────────────────────────────────────────
const EDITOR_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Consolas', monospace",
  fontLigatures: true,
  lineHeight: 21,
  letterSpacing: 0.3,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: "line" as const,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 4,
  glyphMargin: false,
  folding: true,
  wordWrap: "off" as const,
  automaticLayout: true,
  readOnly: true,
  padding: { top: 12, bottom: 12 },
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    vertical: "auto" as const,
    horizontal: "auto" as const,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderWhitespace: "selection" as const,
  bracketPairColorization: { enabled: true },
  guides: {
    indentation: true,
    bracketPairs: false,
  },
  smoothScrolling: true,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
}

interface CodeEditorProps {
  file: V2ProjectFile | null
}

export function CodeEditor({ file }: CodeEditorProps) {
  const [copied, setCopied]     = useState(false)
  const editorRef               = useRef<Parameters<OnMount>[0] | null>(null)

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const copy = () => {
    if (!file) return
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0e0e0e]">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <span className="font-mono text-lg text-white/15">{"</>"}</span>
          </div>
          <p className="text-[13px] text-white/25">Select a file to view</p>
          <p className="mt-0.5 text-[11px] text-white/15">Open the file explorer →</p>
        </div>
      </div>
    )
  }

  const language = detectLanguage(file)
  const lineCount = file.content.split("\n").length

  return (
    <div className="flex h-full flex-col bg-[#0e0e0e]">
      {/* File info bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.05] px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">
            {language}
          </span>
          <span className="text-white/10">·</span>
          <span className="font-mono text-[11px] text-white/40">{file.path}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/18">{lineCount} lines</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/30 transition-colors hover:border-white/15 hover:text-white/60"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        <Editor
          language={language}
          value={file.content}
          theme="vs-dark"
          options={EDITOR_OPTIONS}
          onMount={handleMount}
        />
      </div>
    </div>
  )
}
