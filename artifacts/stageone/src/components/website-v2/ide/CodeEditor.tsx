import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Lightweight syntax highlighter (same as CodeViewer, self-contained) ──────

const KEYWORDS = new Set([
  "const","let","var","function","class","return","import","export","default",
  "from","interface","type","extends","implements","new","typeof","instanceof",
  "if","else","for","while","do","switch","case","break","continue","try","catch",
  "finally","throw","async","await","null","undefined","true","false","void","never",
  "string","number","boolean","object","any","unknown","readonly","static","public",
  "private","protected","abstract","enum","namespace","declare","as","in","of","keyof",
  "satisfies","using",
])

function escHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
}

function highlightLine(raw: string): string {
  const result: string[] = []
  let i = 0
  const line = raw
  while (i < line.length) {
    if (line[i] === "/" && line[i+1] === "/") {
      result.push(`<span style="color:#6b7280;font-style:italic">${escHtml(line.slice(i))}</span>`)
      break
    }
    if (line[i] === "<" && i + 1 < line.length && /[A-Za-z\/!]/.test(line[i+1])) {
      let j = i + 1
      while (j < line.length && line[j] !== ">") j++
      const tag = line.slice(i, j + 1)
      const colored = escHtml(tag).replace(/^(&lt;\/?)([A-Za-z][A-Za-z0-9.]*)/, (_, prefix, name) => {
        const color = /^[A-Z]/.test(name) ? "#c084fc" : "#60a5fa"
        return `${prefix}<span style="color:${color}">${name}</span>`
      })
      result.push(`<span style="color:#9ca3af">${colored}</span>`)
      i = j + 1
      continue
    }
    if (line[i] === "`") {
      let j = i + 1
      while (j < line.length && line[j] !== "`") { if (line[j] === "\\") j++; j++ }
      result.push(`<span style="color:#86efac">${escHtml(line.slice(i, j + 1))}</span>`)
      i = j + 1
      continue
    }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]; let j = i + 1
      while (j < line.length && line[j] !== q) { if (line[j] === "\\") j++; j++ }
      result.push(`<span style="color:#86efac">${escHtml(line.slice(i, j + 1))}</span>`)
      i = j + 1
      continue
    }
    if (/[A-Za-z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (KEYWORDS.has(word)) result.push(`<span style="color:#c084fc;font-weight:600">${escHtml(word)}</span>`)
      else if (/^[A-Z]/.test(word)) result.push(`<span style="color:#93c5fd">${escHtml(word)}</span>`)
      else result.push(escHtml(word))
      i = j
      continue
    }
    if (/[0-9]/.test(line[i])) {
      let j = i
      while (j < line.length && /[0-9._]/.test(line[j])) j++
      result.push(`<span style="color:#fb923c">${escHtml(line.slice(i, j))}</span>`)
      i = j
      continue
    }
    result.push(escHtml(line[i]))
    i++
  }
  return result.join("")
}

function highlight(code: string): string {
  return code.split("\n").map(highlightLine).join("\n")
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CodeEditorProps {
  file: V2ProjectFile | null
}

export function CodeEditor({ file }: CodeEditorProps) {
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
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <span className="font-mono text-xl text-white/20">{"</>"}</span>
          </div>
          <p className="text-sm text-white/30">Select a file to view its code</p>
          <p className="mt-1 text-xs text-white/20">Click any file in the explorer →</p>
        </div>
      </div>
    )
  }

  const lines = file.content.split("\n")
  const highlightedLines = highlight(file.content).split("\n")

  return (
    <div className="flex h-full flex-col bg-[#0e0e0e]">
      {/* File header bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0d0d0d] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/25 uppercase tracking-wider">
            {file.language ?? "code"}
          </span>
          <span className="text-white/15">·</span>
          <span className="font-mono text-[12px] text-white/55">{file.path}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/20">{lines.length} lines</span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12.5px] leading-5">
          <tbody>
            {highlightedLines.map((hl, idx) => (
              <tr key={idx} className="group hover:bg-white/[0.018]">
                <td
                  className="w-12 select-none border-r border-white/[0.04] pr-3 text-right font-mono text-[11px] text-white/18 group-hover:text-white/30"
                  style={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 12 }}
                >
                  {idx + 1}
                </td>
                <td className="pl-4 font-mono text-white/80" style={{ paddingTop: 2, paddingBottom: 2 }}>
                  <span dangerouslySetInnerHTML={{ __html: hl || "&nbsp;" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
