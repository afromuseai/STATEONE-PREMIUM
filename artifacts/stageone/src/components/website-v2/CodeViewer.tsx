import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Lightweight TypeScript/TSX syntax highlighter ───────────────────────────
// No external dependency. Processes code line-by-line with token matching.

const KEYWORDS = new Set([
  "const","let","var","function","class","return","import","export","default",
  "from","interface","type","extends","implements","new","typeof","instanceof",
  "if","else","for","while","do","switch","case","break","continue","try","catch",
  "finally","throw","async","await","null","undefined","true","false","void","never",
  "string","number","boolean","object","any","unknown","readonly","static","public",
  "private","protected","abstract","enum","namespace","declare","as","in","of","keyof",
  "satisfies","using",
])

function escHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
}

function highlightLine(raw: string): string {
  // Escape HTML first
  let line = raw

  // Track positions of already-highlighted regions to avoid double-processing
  // Strategy: build an output string token by token
  const result: string[] = []
  let i = 0

  while (i < line.length) {
    // Line comment
    if (line[i] === "/" && line[i+1] === "/") {
      result.push(`<span style="color:#6b7280;font-style:italic">${escHtml(line.slice(i))}</span>`)
      break
    }

    // JSX/HTML tags — simple detection: < followed by letter or /
    if (line[i] === "<" && i + 1 < line.length && /[A-Za-z\/!]/.test(line[i+1])) {
      // find closing >
      let j = i + 1
      while (j < line.length && line[j] !== ">") j++
      const tag = line.slice(i, j + 1)
      // color opening tag name
      const colored = escHtml(tag)
        .replace(/^(&lt;\/?)([A-Za-z][A-Za-z0-9.]*)/, (_, prefix, name) => {
          const color = /^[A-Z]/.test(name) ? "#c084fc" : "#60a5fa"
          return `${prefix}<span style="color:${color}">${name}</span>`
        })
      result.push(`<span style="color:#9ca3af">${colored}</span>`)
      i = j + 1
      continue
    }

    // Template literal (backtick)
    if (line[i] === "`") {
      let j = i + 1
      while (j < line.length && line[j] !== "`") {
        if (line[j] === "\\") j++ // skip escaped char
        j++
      }
      result.push(`<span style="color:#86efac">${escHtml(line.slice(i, j + 1))}</span>`)
      i = j + 1
      continue
    }

    // String literals (single or double quote)
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]
      let j = i + 1
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++
        j++
      }
      result.push(`<span style="color:#86efac">${escHtml(line.slice(i, j + 1))}</span>`)
      i = j + 1
      continue
    }

    // Word token (keyword, identifier, number)
    if (/[A-Za-z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (KEYWORDS.has(word)) {
        result.push(`<span style="color:#c084fc;font-weight:600">${escHtml(word)}</span>`)
      } else if (/^[A-Z]/.test(word)) {
        result.push(`<span style="color:#93c5fd">${escHtml(word)}</span>`)
      } else {
        result.push(escHtml(word))
      }
      i = j
      continue
    }

    // Number
    if (/[0-9]/.test(line[i])) {
      let j = i
      while (j < line.length && /[0-9._]/.test(line[j])) j++
      result.push(`<span style="color:#fb923c">${escHtml(line.slice(i, j))}</span>`)
      i = j
      continue
    }

    // Operator / punctuation
    result.push(escHtml(line[i]))
    i++
  }

  return result.join("")
}

function highlight(code: string): string {
  return code
    .split("\n")
    .map(highlightLine)
    .join("\n")
}

// ─── Component ────────────────────────────────────────────────────────────────
interface CodeViewerProps {
  file: V2ProjectFile | null
}

export function CodeViewer({ file }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!file) return
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
            <span className="text-xl">{"</>"}</span>
          </div>
          <p className="text-sm text-white/30">Select a file to view its code</p>
        </div>
      </div>
    )
  }

  const lines = file.content.split("\n")
  const highlighted = highlight(file.content)
  const highlightedLines = highlighted.split("\n")

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
            {file.language ?? "code"}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[12px] text-white/60">{file.path}</span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12.5px] leading-5">
          <tbody>
            {highlightedLines.map((hl, idx) => (
              <tr key={idx} className="group hover:bg-white/[0.02]">
                <td className="w-10 select-none border-r border-white/5 pr-3 text-right font-mono text-[11px] text-white/20 group-hover:text-white/35"
                  style={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 8 }}>
                  {idx + 1}
                </td>
                <td className="pl-4 font-mono text-white/85" style={{ paddingTop: 2, paddingBottom: 2 }}>
                  <span dangerouslySetInnerHTML={{ __html: hl || "&nbsp;" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/8 px-4 py-1.5">
        <span className="text-[10px] text-white/20">{lines.length} lines</span>
        <span className="text-[10px] text-white/20">Read-only</span>
      </div>
    </div>
  )
}
