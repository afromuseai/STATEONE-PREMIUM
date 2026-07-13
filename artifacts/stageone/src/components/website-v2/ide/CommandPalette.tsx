// ─── Phase P1 — Command Palette ───────────────────────────────────────────────
// VS Code/Cursor-style command palette triggered by Ctrl+K.
// Supports keyboard navigation, fuzzy search, and grouped commands.

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Cpu, Code2, Wand2, RefreshCw, Globe, Upload,
  Package, Shield, Users, FileCode, Terminal, Zap, ChevronRight,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PaletteCommand {
  id:          string
  label:       string
  description: string
  icon:        React.ElementType
  color?:      string
  category:    string
  shortcut?:   string
  action:      () => void
}

export interface CommandPaletteProps {
  open:         boolean
  onClose:      () => void
  activeFile?:  string | null
  // Dispatched actions
  onAskMarcus:  (prompt: string) => void
  onDeploy:     () => void
  onCodeReview: () => void
}

export function CommandPalette({
  open, onClose, activeFile, onAskMarcus, onDeploy, onCodeReview,
}: CommandPaletteProps) {
  const [query,       setQuery]       = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Command definitions ─────────────────────────────────────────────────────
  const COMMANDS: PaletteCommand[] = [
    {
      id: "ask-marcus", label: "Ask Marcus", category: "AI",
      description: "Open the AI agent and type your request",
      icon: Cpu, color: "#f59e0b",
      action: () => { onAskMarcus(""); onClose() },
    },
    {
      id: "create-component", label: "Create component", category: "AI",
      description: "Generate a new React component with Marcus",
      icon: Code2, color: "#818cf8",
      action: () => { onAskMarcus("Create a new reusable React component for this project. Ask me what it should do."); onClose() },
    },
    {
      id: "explain-code", label: "Explain code", category: "AI",
      description: activeFile ? `Explain ${activeFile.split("/").pop()}` : "Explain the active file",
      icon: Wand2, color: "#34d399",
      shortcut: "⌘E",
      action: () => {
        const file = activeFile ? activeFile.split("/").pop() : "the active file"
        onAskMarcus(`Explain what ${file} does. Walk me through the logic step by step.`)
        onClose()
      },
    },
    {
      id: "refactor-file", label: "Refactor file", category: "AI",
      description: "Improve structure, readability, and performance",
      icon: RefreshCw, color: "#a78bfa",
      action: () => {
        const file = activeFile ? activeFile.split("/").pop() : "the active file"
        onAskMarcus(`Refactor ${file} for better readability and performance. Follow the existing code style.`)
        onClose()
      },
    },
    {
      id: "generate-api", label: "Generate API endpoint", category: "AI",
      description: "Create a new API route with Marcus",
      icon: Globe, color: "#60a5fa",
      action: () => { onAskMarcus("Generate a new API endpoint. What should it do?"); onClose() },
    },
    {
      id: "install-package", label: "Install package", category: "AI",
      description: "Add an npm package to the project",
      icon: Package, color: "#fb923c",
      action: () => { onAskMarcus("Install a new package. Which one should I add?"); onClose() },
    },
    {
      id: "generate-tests", label: "Generate tests", category: "AI",
      description: "Write unit tests for the active file",
      icon: FileCode, color: "#86efac",
      action: () => {
        const file = activeFile ? activeFile.split("/").pop() : "the active file"
        onAskMarcus(`Generate comprehensive unit tests for ${file}. Cover edge cases.`)
        onClose()
      },
    },
    {
      id: "run-terminal", label: "Open terminal", category: "Tools",
      description: "Open the terminal overlay",
      icon: Terminal, color: "#94a3b8",
      shortcut: "⌃`",
      action: () => onClose(),
    },
    {
      id: "code-review", label: "AI Code Review", category: "Tools",
      description: "Run security, performance, and SEO analysis",
      icon: Shield, color: "#f472b6",
      action: () => { onCodeReview(); onClose() },
    },
    {
      id: "deploy", label: "Deploy project", category: "Tools",
      description: "Launch the deployment pipeline",
      icon: Upload, color: "#fbbf24",
      shortcut: "⌘D",
      action: () => { onDeploy(); onClose() },
    },
    {
      id: "collaboration", label: "Invite collaborator", category: "Team",
      description: "Share this project with your team",
      icon: Users, color: "#6ee7b7",
      action: () => onClose(),
    },
  ]

  // ── Filtered commands ────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS

  // Group by category
  const grouped = filtered.reduce<Record<string, PaletteCommand[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  // Flat list for keyboard navigation
  const flat = filtered

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setActiveIndex(0) }, [query])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && flat[activeIndex]) {
      e.preventDefault()
      flat[activeIndex].action()
    } else if (e.key === "Escape") {
      onClose()
    }
  }, [flat, activeIndex, onClose])

  const globalIndex = (cmd: PaletteCommand) => flat.findIndex(c => c.id === cmd.id)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[200] bg-[#202020] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[15%] z-[201] w-full max-w-[560px] -translate-x-1/2"
          >
            <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] shadow-md shadow-black/80">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
                <Search className="h-4 w-4 flex-shrink-0 text-[#ECECEC]/25" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent text-[13px] text-[#ECECEC] placeholder-white/20 outline-none"
                />
                <kbd className="flex-shrink-0 rounded border border-[rgba(255,255,255,0.08)] bg-[#252525] px-1.5 py-0.5 font-mono text-[10px] text-[#ECECEC]/25">
                  ESC
                </kbd>
              </div>

              {/* Command list */}
              <div className="max-h-[360px] overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
                {flat.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-[#ECECEC]/25">
                    No commands found for "{query}"
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, cmds]) => (
                    <div key={category}>
                      <div className="px-4 pb-1 pt-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#ECECEC]/18">
                        {category}
                      </div>
                      {cmds.map(cmd => {
                        const idx = globalIndex(cmd)
                        const Icon = cmd.icon
                        const isActive = idx === activeIndex
                        return (
                          <button
                            key={cmd.id}
                            onClick={cmd.action}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive ? "bg-[#252525]" : "hover:bg-[#252525]"
                            }`}
                          >
                            <div
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
                              style={{ background: `${cmd.color ?? "#6b7280"}18` }}
                            >
                              <Icon className="h-3.5 w-3.5" style={{ color: cmd.color ?? "#6b7280" }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] text-[#ECECEC]">{cmd.label}</span>
                              </div>
                              <p className="truncate text-[11px] text-[#ECECEC]/28">{cmd.description}</p>
                            </div>
                            {cmd.shortcut && (
                              <kbd className="flex-shrink-0 rounded border border-[rgba(255,255,255,0.08)] bg-[#252525] px-1.5 py-0.5 font-mono text-[10px] text-[#ECECEC]/22">
                                {cmd.shortcut}
                              </kbd>
                            )}
                            {isActive && <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#ECECEC]/20" />}
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] px-4 py-2">
                <div className="flex items-center gap-1 text-[#ECECEC]/18">
                  <Zap className="h-3 w-3" />
                  <span className="text-[10px]">Phase P — IDE Intelligence</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#ECECEC]/18">
                  <span>↑↓ navigate</span>
                  <span>↵ execute</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
