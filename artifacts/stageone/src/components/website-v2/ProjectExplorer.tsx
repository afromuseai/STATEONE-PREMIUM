import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Folder, FolderOpen, FileCode, FileJson, FileText, File, ChevronRight } from "lucide-react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Build a file tree from flat paths ───────────────────────────────────────
interface TreeNode {
  name: string
  path: string
  isFile: boolean
  children: TreeNode[]
  file?: V2ProjectFile
}

function buildTree(files: V2ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const f of files) {
    const parts = f.path.split("/")
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      let existing = nodes.find((n) => n.name === part)

      if (!existing) {
        existing = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isFile: isLast,
          children: [],
          file: isLast ? f : undefined,
        }
        nodes.push(existing)
      }
      nodes = existing.children
    }
  }

  // Sort: folders first, then files, both alphabetical
  function sortNodes(ns: TreeNode[]): TreeNode[] {
    return [...ns]
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
  }

  return sortNodes(root)
}

// ─── File icon by extension ───────────────────────────────────────────────────
function FileIcon({ name }: { name: string }) {
  if (name.endsWith(".tsx") || name.endsWith(".ts"))
    return <FileCode className="h-3.5 w-3.5 text-blue-400" />
  if (name.endsWith(".css"))
    return <FileText className="h-3.5 w-3.5 text-pink-400" />
  if (name.endsWith(".json"))
    return <FileJson className="h-3.5 w-3.5 text-yellow-400" />
  return <File className="h-3.5 w-3.5 text-white/40" />
}

// ─── Tree node renderer ───────────────────────────────────────────────────────
function TreeNodeItem({
  node, depth, selectedPath, onSelect,
}: {
  node: TreeNode; depth: number; selectedPath: string | null; onSelect: (f: V2ProjectFile) => void
}) {
  const [open, setOpen] = useState(depth < 1)

  const indent = depth * 14

  if (node.isFile && node.file) {
    const active = selectedPath === node.file.path
    return (
      <button
        onClick={() => onSelect(node.file!)}
        style={{ paddingLeft: indent + 8 }}
        className={`flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left transition-colors duration-100
          ${active ? "bg-amber-400/10 text-amber-300" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`}
      >
        <FileIcon name={node.name} />
        <span className="truncate text-[12px] font-medium">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: indent + 4 }}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-white/70 transition-colors duration-100 hover:bg-white/5 hover:text-white/90"
      >
        <ChevronRight
          className="h-3 w-3 flex-shrink-0 text-white/30 transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {open
          ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/70" />
          : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/50" />}
        <span className="truncate text-[12px] font-semibold">{node.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface ProjectExplorerProps {
  files: V2ProjectFile[]
  selectedFile: V2ProjectFile | null
  onSelectFile: (f: V2ProjectFile) => void
}

export function ProjectExplorer({ files, selectedFile, onSelectFile }: ProjectExplorerProps) {
  const tree = buildTree(files)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Files
        </span>
        <span className="text-[10px] text-white/20">{files.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-white/30">No files</p>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedFile?.path ?? null}
              onSelect={onSelectFile}
            />
          ))
        )}
      </div>
    </div>
  )
}
