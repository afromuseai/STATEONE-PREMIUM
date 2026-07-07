import { useRef, useCallback, useEffect } from "react"
import Editor, { loader, type BeforeMount, type OnMount, type OnChange } from "@monaco-editor/react"
import { Copy, Check, FileCode2, Save } from "lucide-react"
import { useState } from "react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import * as monaco from "monaco-editor"

// Use locally-installed monaco-editor instead of CDN to avoid COOP/COEP issues
loader.config({ monaco })

// ─── STAGEONE dark theme ───────────────────────────────────────────────────────
const defineStageOneTheme: BeforeMount = (m) => {
  m.editor.defineTheme("stageone-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",           foreground: "3d4d5c", fontStyle: "italic" },
      { token: "comment.doc",       foreground: "4a6070", fontStyle: "italic" },
      { token: "keyword",           foreground: "c084fc" },
      { token: "keyword.control",   foreground: "c084fc" },
      { token: "storage.type",      foreground: "c084fc" },
      { token: "string",            foreground: "86efac" },
      { token: "string.escape",     foreground: "34d399" },
      { token: "number",            foreground: "fb923c" },
      { token: "constant.numeric",  foreground: "fb923c" },
      { token: "type",              foreground: "7dd3fc" },
      { token: "type.identifier",   foreground: "7dd3fc" },
      { token: "entity.name.class", foreground: "fcd34d" },
      { token: "entity.name.function", foreground: "60a5fa" },
      { token: "variable.parameter",   foreground: "e2c47d" },
      { token: "variable.language",    foreground: "c084fc" },
      { token: "operator",          foreground: "94a3b8" },
      { token: "delimiter",         foreground: "4a5568" },
      { token: "delimiter.bracket", foreground: "6b7280" },
      { token: "tag",               foreground: "f87171" },
      { token: "tag.id",            foreground: "f87171" },
      { token: "attribute.name",    foreground: "7dd3fc" },
      { token: "attribute.value",   foreground: "86efac" },
      { token: "metatag",           foreground: "fb923c" },
      { token: "invalid",           foreground: "f87171", fontStyle: "underline" },
      { token: "regexp",            foreground: "fdba74" },
    ],
    colors: {
      "editor.background":                   "#0d0d0d",
      "editor.foreground":                   "#c9d1d9",
      "editor.lineHighlightBackground":      "#ffffff07",
      "editor.lineHighlightBorder":          "#00000000",
      "editor.selectionBackground":          "#fbbf2418",
      "editor.inactiveSelectionBackground":  "#fbbf240d",
      "editorLineNumber.foreground":         "#2e2e2e",
      "editorLineNumber.activeForeground":   "#555555",
      "editorCursor.foreground":             "#fbbf24",
      "editorCursor.background":             "#0d0d0d",
      "editorWhitespace.foreground":         "#ffffff0d",
      "editorIndentGuide.background1":       "#ffffff09",
      "editorIndentGuide.activeBackground1": "#ffffff1a",
      "editor.findMatchBackground":          "#fbbf2435",
      "editor.findMatchHighlightBackground": "#fbbf2418",
      "editorBracketMatch.background":       "#fbbf2420",
      "editorBracketMatch.border":           "#fbbf2450",
      "editorBracketHighlight.foreground1":  "#fbbf24",
      "editorBracketHighlight.foreground2":  "#c084fc",
      "editorBracketHighlight.foreground3":  "#60a5fa",
      "scrollbarSlider.background":          "#ffffff0a",
      "scrollbarSlider.hoverBackground":     "#ffffff14",
      "scrollbarSlider.activeBackground":    "#ffffff1e",
      "editorGutter.background":             "#0d0d0d",
      "editorOverviewRuler.background":      "#0d0d0d",
      "editorOverviewRuler.border":          "#00000000",
      "editorOverviewRuler.findMatchForeground": "#fbbf2460",
      "minimap.background":                  "#0d0d0d",
      "minimap.selectionHighlight":          "#fbbf2420",
      "editorWidget.background":             "#111111",
      "editorWidget.border":                 "#ffffff10",
      "editorSuggestWidget.background":      "#111111",
      "editorSuggestWidget.border":          "#ffffff10",
      "editorSuggestWidget.selectedBackground": "#fbbf2415",
      "editorSuggestWidget.highlightForeground": "#fbbf24",
      "input.background":                    "#0a0a0a",
      "input.border":                        "#ffffff12",
      "focusBorder":                         "#fbbf2440",
      "list.hoverBackground":                "#ffffff07",
      "list.activeSelectionBackground":      "#fbbf2415",
    },
  })
}

// ─── Language detection ────────────────────────────────────────────────────────
function detectLanguage(file: V2ProjectFile): string {
  if (file.language) {
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
const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 12.5,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Consolas', monospace",
  fontLigatures: true,
  lineHeight: 20,
  letterSpacing: 0.2,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: "line",
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  glyphMargin: false,
  folding: true,
  foldingHighlight: false,
  wordWrap: "off",
  automaticLayout: true,
  // readOnly removed — Monaco is now the live editor for WC HMR (N4)
  padding: { top: 14, bottom: 24 },
  scrollbar: {
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    vertical: "auto",
    horizontal: "auto",
    useShadows: false,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderWhitespace: "selection",
  bracketPairColorization: { enabled: true },
  guides: {
    indentation: true,
    bracketPairs: false,
    highlightActiveIndentation: true,
  },
  smoothScrolling: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  contextmenu: false,
  stickyScroll: { enabled: false },
}

// ─── File path breadcrumb ─────────────────────────────────────────────────────
function FileBreadcrumb({ path }: { path: string }) {
  const parts = path.split("/")
  return (
    <div className="flex min-w-0 items-center gap-0.5 font-mono text-[11px]">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-white/15">/</span>}
          <span className={i === parts.length - 1 ? "text-white/60" : "text-white/25"}>
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Language badge ────────────────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  typescript: "#60a5fa",
  javascript: "#fbbf24",
  css:        "#f472b6",
  scss:       "#f472b6",
  html:       "#fb923c",
  json:       "#fbbf24",
  markdown:   "#86efac",
  python:     "#86efac",
  yaml:       "#94a3b8",
}

interface CodeEditorProps {
  file: V2ProjectFile | null
  /**
   * Called (debounced 400ms) whenever the editor content changes.
   * The caller should write this content to the WC filesystem to trigger HMR.
   */
  onFileWrite?: (content: string) => void
}

export function CodeEditor({ file, onFileWrite }: CodeEditorProps) {
  const [copied,  setCopied]  = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const editorRef   = useRef<Parameters<OnMount>[0] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending debounce on unmount or tab switch to prevent stale writes
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor

    // Ctrl+S / Cmd+S — flush the debounce immediately
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (!onFileWrite) return
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        const content = editor.getValue()
        onFileWrite(content)
        setIsDirty(false)
      },
    )
  }

  // Debounced onChange → WC writeFile (N4)
  const handleChange: OnChange = useCallback((value) => {
    if (value === undefined) return
    setIsDirty(true)
    if (!onFileWrite) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFileWrite(value)
      setIsDirty(false)
    }, 400)
  }, [onFileWrite])

  const copy = () => {
    if (!file) return
    const content = editorRef.current?.getValue() ?? file.content
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0d]">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02]">
            <FileCode2 className="h-5 w-5 text-white/12" />
          </div>
          <p className="text-[12px] font-medium text-white/20">Select a file to view</p>
          <p className="mt-1 text-[11px] text-white/12">Open the file explorer →</p>
        </div>
      </div>
    )
  }

  const language  = detectLanguage(file)
  const lineCount = file.content.split("\n").length
  const langColor = LANG_COLORS[language] ?? "#6b7280"

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      {/* ── File info bar ──────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/[0.05] bg-[#0b0b0b] px-4 py-1.5">
        <FileBreadcrumb path={file.path} />

        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          {/* Dirty indicator */}
          {isDirty && onFileWrite && (
            <div className="flex items-center gap-1 text-amber-400/60">
              <Save className="h-3 w-3" />
              <span className="font-mono text-[9px]">saving…</span>
            </div>
          )}

          {/* Language badge */}
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: langColor, background: `${langColor}1a` }}
          >
            {language}
          </span>

          {/* Line count */}
          <span className="text-[10px] tabular-nums text-white/18">
            {lineCount.toLocaleString()} lines
          </span>

          {/* Copy button */}
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/28 transition-all hover:border-white/12 hover:text-white/60"
          >
            {copied
              ? <Check className="h-3 w-3 text-emerald-400" />
              : <Copy  className="h-3 w-3" />
            }
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* ── Monaco ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Editor
          language={language}
          value={file.content}
          theme="stageone-dark"
          options={EDITOR_OPTIONS}
          beforeMount={defineStageOneTheme}
          onMount={handleMount}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
