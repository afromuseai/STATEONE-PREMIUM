import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight, Folder, FolderOpen, FileCode, FileJson,
  FileText, File, FilePlus, Search, MoreHorizontal, Eye,
} from "lucide-react"
import { useState, useMemo } from "react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Tree builder ──────────────────────────────────────────────────────────────
interface TreeNode {
  name:     string
  path:     string
  isFile:   boolean
  children: TreeNode[]
  file?:    V2ProjectFile
}

function buildTree(files: V2ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const f of files) {
    const parts = f.path.split("/")
    let nodes   = root
    for (let i = 0; i < parts.length; i++) {
      const part   = parts[i]
      const isLast = i === parts.length - 1
      let existing = nodes.find((n) => n.name === part)
      if (!existing) {
        existing = {
          name:     part,
          path:     parts.slice(0, i + 1).join("/"),
          isFile:   isLast,
          children: [],
          file:     isLast ? f : undefined,
        }
        nodes.push(existing)
      }
      nodes = existing.children
    }
  }
  function sort(ns: TreeNode[]): TreeNode[] {
    return [...ns]
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      .map((n) => ({ ...n, children: sort(n.children) }))
  }
  return sort(root)
}

// ─── File icon ─────────────────────────────────────────────────────────────────
function FileIconEl({ name }: { name: string }) {
  if (name.endsWith(".tsx") || name.endsWith(".ts"))
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-blue-400/65" />
  if (name.endsWith(".css") || name.endsWith(".scss"))
    return <FileText className="h-3.5 w-3.5 flex-shrink-0 text-pink-400/65" />
  if (name.endsWith(".json"))
    return <FileJson className="h-3.5 w-3.5 flex-shrink-0 text-yellow-400/65" />
  if (name.endsWith(".md") || name.endsWith(".mdx"))
    return <FileText className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400/55" />
  if (name.endsWith(".html"))
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-orange-400/65" />
  return <File className="h-3.5 w-3.5 flex-shrink-0 text-white/22" />
}

// ─── Tree node ─────────────────────────────────────────────────────────────────
function TreeNodeItem({
  node, depth, activePath, onSelect, searchQuery,
}: {
  node:        TreeNode
  depth:       number
  activePath:  string | null
  onSelect:    (f: V2ProjectFile) => void
  searchQuery: string
}) {
  const [open, setOpen]       = useState(depth < 1)
  const [hovered, setHovered] = useState(false)
  const isExpanded = searchQuery ? true : open
  const indent     = depth * 12

  const matchesSearch = (n: TreeNode): boolean => {
    if (searchQuery === "") return true
    if (n.isFile) return n.name.toLowerCase().includes(searchQuery.toLowerCase())
    return n.children.some(matchesSearch)
  }

  if (!matchesSearch(node)) return null

  // ── File row ────────────────────────────────────────────────────────────────
  if (node.isFile && node.file) {
    const active = activePath === node.file.path
    return (
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={() => onSelect(node.file!)}
          style={{ paddingLeft: indent + 8 }}
          className={`group flex w-full items-center gap-1.5 rounded py-[3px] pr-1 text-left transition-colors duration-75
            ${active
              ? "bg-amber-400/10 text-amber-300/85"
              : "text-white/42 hover:bg-white/[0.04] hover:text-white/70"
            }`}
        >
          <FileIconEl name={node.name} />
          <span className="flex-1 truncate text-[11.5px]">
            {searchQuery
              ? <HighlightMatch text={node.name} query={searchQuery} />
              : node.name
            }
          </span>

          {/* Hover actions */}
          <AnimatePresence>
            {(hovered || active) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex flex-shrink-0 items-center gap-0.5 pr-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  title="Open file"
                  aria-label={`Open ${node.name}`}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded text-white/25 transition-colors hover:bg-white/[0.08] hover:text-white/65"
                  onClick={() => onSelect(node.file!)}
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="More options"
                  aria-label={`More options for ${node.name}`}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded text-white/25 transition-colors hover:bg-white/[0.08] hover:text-white/65"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Active file left accent */}
        {active && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-r bg-amber-400/60" />
        )}
      </div>
    )
  }

  // ── Folder row ──────────────────────────────────────────────────────────────
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: indent + 4 }}
        className="group flex w-full items-center gap-1 rounded py-[3px] pr-2 text-left text-white/48 transition-colors duration-75 hover:bg-white/[0.03] hover:text-white/75"
      >
        <ChevronRight
          className="h-3 w-3 flex-shrink-0 text-white/18 transition-transform duration-100"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {isExpanded
          ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/50" />
          : <Folder     className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/30" />
        }
        <span className="truncate text-[11.5px] font-medium">{node.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
                searchQuery={searchQuery}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="rounded bg-amber-400/20 text-amber-300">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Main drawer ───────────────────────────────────────────────────────────────
interface FileExplorerDrawerProps {
  open:           boolean
  files:          V2ProjectFile[]
  activeFilePath: string | null
  onSelectFile:   (f: V2ProjectFile) => void
  onClose:        () => void
}

export function FileExplorerDrawer({
  open, files, activeFilePath, onSelectFile,
}: FileExplorerDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const tree = useMemo(() => buildTree(files), [files])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 220, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="flex flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.05] bg-[#0a0a0a]"
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.05] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/22">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] tabular-nums text-white/15">{files.length} files</span>
              <button
                title="New file"
                className="ml-1.5 flex h-5 w-5 items-center justify-center rounded text-white/18 transition-colors hover:bg-white/[0.06] hover:text-white/55"
              >
                <FilePlus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-b border-white/[0.04] px-2 py-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-[5px] transition-colors focus-within:border-white/[0.10]">
              <Search className="h-3 w-3 flex-shrink-0 text-white/18" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files…"
                className="w-full bg-transparent text-[11px] text-white/52 placeholder-white/18 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-white/25 hover:text-white/55"
                >
                  <span className="text-[9px]">✕</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Tree ───────────────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto px-1.5 py-1"
            style={{ scrollbarWidth: "none" }}
          >
            {tree.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-white/18">No files yet</p>
            ) : (
              tree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activeFilePath}
                  onSelect={onSelectFile}
                  searchQuery={searchQuery}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
