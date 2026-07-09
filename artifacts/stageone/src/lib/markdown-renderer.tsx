import React from "react"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function renderInline(text: string): (React.ReactNode | string)[] {
  const nodes: (React.ReactNode | string)[] = []
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={nodes.length}>{escapeHtml(part.slice(2, -2))}</strong>)
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
      nodes.push(<em key={nodes.length}>{escapeHtml(part.slice(1, -1))}</em>)
    } else if (part) {
      nodes.push(<React.Fragment key={nodes.length}>{escapeHtml(part)}</React.Fragment>)
    }
  }
  return nodes
}

function wrapNodes(key: string, nodes: (React.ReactNode | string)[]): React.ReactNode {
  return nodes.length === 1 ? nodes[0] : <React.Fragment key={key}>{nodes}</React.Fragment>
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n")
  const children: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let hasParagraph = false

  function flushList() {
    if (listItems.length > 0) {
      children.push(<ul key={children.length} className="list-disc pl-5 space-y-1">{listItems}</ul>)
      listItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    if (trimmed === "") {
      flushList()
      hasParagraph = false
      continue
    }

    if (/^[-*+]\s/.test(trimmed)) {
      listItems.push(<li key={listItems.length}>{wrapNodes(`${i}`, renderInline(trimmed.replace(/^[-*+]\s/, "")))}</li>)
      continue
    }

    flushList()

    const key = `p${i}`
    const content = wrapNodes(key, renderInline(trimmed))
    if (hasParagraph) {
      children.push(<br key={`br${i}`} />)
      children.push(<React.Fragment key={key}>{content}</React.Fragment>)
    } else {
      children.push(<React.Fragment key={key}>{content}</React.Fragment>)
      hasParagraph = true
    }
  }

  flushList()

  return <>{children}</>
}