import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Folder, FolderOpen, FileCode, FileJson, FileText, File, X, FolderTree } from "lucide-react"
import { useState } from "react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Tree builder (same logic as ProjectExplorer) ─────────────────────────────
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
    let nodes = root
    for (let i = 0; i < parts.length; i++) {
      const part   = parts[i]
      const isLast = i === parts.length - 1
      let existing = nodes.find((n) => n.name === part)
      if (!existing) {
        existing = { name: part, path: parts.slice(0, i + 1).join("/"), isFile: isLast, children: [], file: isLast ? f : undefined }
        nodes.push(existing)
      }
      nodes = existing.children
    }
  }
  function sort(ns: TreeNode[]): TreeNode[] {
    return [...ns]
      .sort((a, b) => { if (a.isFile !== b.isFile) return a.isFile ? 1 : -1; return a.name.localeCompare(b.name) })
      .map((n) => ({ ...n, children: sort(n.children) }))
  }
  return sort(root)
}

// ─── File icon ────────────────────────────────────────────────────────────────
function FileIcon({ name }: { name: string }) {
  if (name.endsWith(".tsx") || name.endsWith(".ts"))
    return <FileCode className="h-3.5 w-3.5 text-blue-400/80" />
  if (name.endsWith(".css"))
    return <FileText className="h-3.5 w-3.5 text-pink-400/80" />
  if (name.endsWith(".json"))
    return <FileJson className="h-3.5 w-3.5 text-yellow-400/80" />
  return <File className="h-3.5 w-3.5 text-white/35" />
}

// ─── Tree node ────────────────────────────────────────────────────────────────
function TreeNodeItem({
  node, depth, activePath, onSelect,
}: {
  node: TreeNode; depth: number; activePath: string | null; onSelect: (f: V2ProjectFile) => void
}) {
  const [open, setOpen] = useState(depth < 1)
  const indent = depth * 12

  if (node.isFile && node.file) {
    const active = activePath === node.file.path
    return (
      <button
        onClick={() => onSelect(node.file!)}
        style={{ paddingLeft: indent + 8 }}
        className={`flex w-full items-center gap-2 rounded-md py-[3px] pr-2 text-left transition-colors duration-100
          ${active
            ? "bg-amber-400/10 text-amber-300"
            : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
          }`}
      >
        <FileIcon name={node.name} />
        <span className="truncate text-[11.5px] font-medium">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: indent + 4 }}
        className="flex w-full items-center gap-1.5 rounded-md py-[3px] pr-2 text-left text-white/60 transition-colors duration-100 hover:bg-white/[0.04] hover:text-white/85"
      >
        <ChevronRight
          className="h-3 w-3 flex-shrink-0 text-white/25 transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {open
          ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/60" />
          : <Folder     className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/40" />}
        <span className="truncate text-[11.5px] font-semibold">{node.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.13, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNodeItem key={child.path} node={child} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────
interface FileExplorerDrawerProps {
  open:           boolean
  files:          V2ProjectFile[]
  activeFilePath: string | null
  onSelectFile:   (f: V2ProjectFile) => void
  onClose:        () => void
}

export function FileExplorerDrawer({ open, files, activeFilePath, onSelectFile, onClose }: FileExplorerDrawerProps) {
  const tree = buildTree(files)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 220, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="flex flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.07] bg-[#0a0a0a]"
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FolderTree className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                Files
              </span>
              <span className="text-[10px] text-white/20">{files.length}</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center rounded text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/60"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto px-1.5 py-2">
            {tree.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-white/25">No files yet</p>
            ) : (
              tree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activeFilePath}
                  onSelect={onSelectFile}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
