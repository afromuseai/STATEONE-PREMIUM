// ─── WebsiteStudioComposer — the message input for Website Studio's AI Engineer
// panel: textarea, attachments, drag-and-drop, send/stop. It is a controlled,
// presentational component: the parent owns the input text and submit/cancel
// behavior; this component owns its own attachment/drag-and-drop UI state.
// It holds no reference to the legacy AgentRuntime.
//
// The orbit border (ORBIT_STYLE / ac-orbit-wrapper / ac-orbit-inner) lives
// here unchanged — colors, timing, and structure are intentional and must not
// be modified. It now activates for Website Studio's own `isGenerating` state
// as well as the interactive editing runtime's `isRunning` state, so the ring
// is visible for both "the AI is building" and "the AI is working on an edit".
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowUp, Plus, X, Loader2, FileText, ImageIcon, Layers, Square, UploadCloud,
} from "lucide-react"

// ─── Orbit animation (AI-processing border effect) ───────────────────────────
export const ORBIT_STYLE = `
@keyframes ac-orbit-spin {
  from { transform: translateZ(0) rotate(0deg); }
  to   { transform: translateZ(0) rotate(360deg); }
}
/* wrapper clips + padding creates the visible border ring */
.ac-orbit-wrapper {
  position: relative;
  border-radius: 17px;
  overflow: hidden;
  padding: 1.5px;
}
/* gradient fills beyond the box; clipped by overflow:hidden */
.ac-orbit-wrapper::before {
  content: '';
  position: absolute;
  inset: -100%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    transparent 30%,
    #D4A72C 50%,
    #ffffff 65%,
    transparent 80%,
    transparent 100%
  );
  animation: ac-orbit-spin 2.4s linear infinite;
  z-index: 0;
  will-change: transform;
}
/* inner card sits above the gradient; its bg masks the gradient in the center */
.ac-orbit-inner {
  position: relative;
  z-index: 1;
}
`

export interface WebsiteStudioComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  /** Website Studio's own state — the initial full-site build is streaming. */
  isGenerating: boolean
  /** The interactive editing runtime is actively working on a follow-up edit. */
  isRunning: boolean
  /** Whether the current work can actually be cancelled (only the editing
   *  runtime supports this today — the initial build is fire-and-forget). */
  canStop: boolean
}

export function WebsiteStudioComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  isGenerating,
  isRunning,
  canStop,
}: WebsiteStudioComposerProps) {
  const busy = isGenerating || isRunning

  // Attach state — local to the composer, presentation-only.
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; name: string; type: "image" | "file" }>>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  // Drag-and-drop attach state — dropping files anywhere on the composer attaches them,
  // same list the "+" menu populates.
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef  = useRef<HTMLInputElement | null>(null)
  const attachMenuRef = useRef<HTMLDivElement | null>(null)
  const inputRef      = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize textarea — use "1px" not "auto" to avoid a collapse frame
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "1px"
    const next = Math.min(el.scrollHeight, 180)
    el.style.height = `${Math.max(next, 48)}px`
  }, [value])

  // Close attach menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files
    if (!picked) return
    const newFiles = Array.from(picked).map(f => ({
      id:   `${f.name}-${Date.now()}`,
      name: f.name,
      type: f.type.startsWith("image/") ? "image" as const : "file" as const,
    }))
    setAttachedFiles(prev => [...prev, ...newFiles])
    setShowAttachMenu(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (busy) return
    setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (busy) return
    const dropped = e.dataTransfer.files
    if (!dropped || dropped.length === 0) return
    const newFiles = Array.from(dropped).map(f => ({
      id:   `${f.name}-${Date.now()}`,
      name: f.name,
      type: f.type.startsWith("image/") ? "image" as const : "file" as const,
    }))
    setAttachedFiles(prev => [...prev, ...newFiles])
  }

  return (
    <>
      <style>{ORBIT_STYLE}</style>
      <div className="flex-shrink-0 bg-[#202020] px-3 pt-3 pb-2.5">

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* File chips */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-1.5 pb-2 overflow-hidden"
            >
              {attachedFiles.map(f => (
                <div
                  key={f.id}
                  className="flex items-center gap-1 rounded-md border border-[#303030] bg-[#232323] px-2 py-1"
                >
                  {f.type === "image"
                    ? <ImageIcon className="h-3 w-3 text-[#A0A0A0]" />
                    : <FileText  className="h-3 w-3 text-[#A0A0A0]" />}
                  <span className="max-w-[100px] truncate text-[11px] text-[#ECECEC]/80">{f.name}</span>
                  <button
                    onClick={() => setAttachedFiles(prev => prev.filter(x => x.id !== f.id))}
                    className="ml-0.5 text-[#A0A0A0] hover:text-[#ECECEC] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ECECEC]/40 rounded-sm"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer card — protected orbit border while Website Studio is
            generating or the editing runtime is actively working. DO NOT
            modify ac-orbit-wrapper/ac-orbit-inner or ORBIT_STYLE above:
            colors, timing, and structure are intentional and must remain
            exactly as they are. */}
        <div
          className={`relative ${busy ? "ac-orbit-wrapper" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div
            className={`${busy ? "ac-orbit-inner" : "rounded-2xl border"} bg-[#232323] transition-colors ${
              isDragOver ? "border-[#A0A0A0]" : ""
            }`}
            style={busy
              ? { borderRadius: "15.5px" }
              : { borderColor: isDragOver ? undefined : "#303030", borderStyle: isDragOver ? "dashed" : "solid" }}
          >
            {/* Drag-and-drop overlay */}
            <AnimatePresence>
              {isDragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-[#232323]/95"
                >
                  <UploadCloud className="h-4 w-4 text-[#A0A0A0]" />
                  <span className="text-[12px] text-[#A0A0A0]">Drop to attach</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea — auto-grows via the resize effect above; Enter sends,
                Shift+Enter inserts a newline (see handleKey). */}
            <div className="px-3.5 pt-3 pb-2">
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  isGenerating
                    ? "AI is building your website…"
                    : isRunning
                    ? "Working…"
                    : "Describe what you want to build…"
                }
                disabled={busy}
                rows={1}
                aria-label="Message AI Engineer"
                style={{ minHeight: "48px", maxHeight: "180px", lineHeight: "1.6" }}
                className="w-full resize-none bg-transparent text-[13px] text-[#ECECEC] placeholder:text-[#A0A0A0]/70 focus:outline-none disabled:cursor-not-allowed overflow-y-auto"
              />
            </div>

            {/* Bottom toolbar: + left, stop/send right */}
            <div className="flex items-center justify-between px-2 pb-2">

              {/* Left — attach dropdown */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  onClick={() => setShowAttachMenu(v => !v)}
                  disabled={busy}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A0A0A0] transition-colors hover:bg-[#303030] hover:text-[#ECECEC] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ECECEC]/30"
                  title="Attach"
                  aria-label="Attach files"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-[#303030] bg-[#232323] shadow-2xl overflow-hidden z-50"
                    >
                      {[
                        {
                          label: "Upload image",
                          icon: <ImageIcon className="h-3.5 w-3.5" />,
                          action: () => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = "image/*"
                              fileInputRef.current.click()
                            }
                          },
                        },
                        {
                          label: "Upload file",
                          icon: <FileText className="h-3.5 w-3.5" />,
                          action: () => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = "*/*"
                              fileInputRef.current.click()
                            }
                          },
                        },
                        {
                          label: "Project assets",
                          icon: <Layers className="h-3.5 w-3.5" />,
                          action: () => setShowAttachMenu(false),
                        },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={item.action}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#A0A0A0] transition-colors hover:bg-[#303030] hover:text-[#ECECEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ECECEC]/30"
                        >
                          <span className="text-[#A0A0A0]">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right — send, or Stop when the interactive runtime can be
                  cancelled. The initial full-site build has no cancel hook
                  (that lives in the generation engine, out of scope here),
                  so it shows an inert "Generating…" state instead of a
                  button that would silently do nothing. */}
              <div className="flex items-center gap-2">
                {canStop ? (
                  <button
                    onClick={onCancel}
                    className="flex h-7 items-center gap-1.5 rounded-lg bg-[#303030] px-2.5 text-[11px] font-medium text-[#ECECEC] transition-colors hover:bg-[#303030]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ECECEC]/30"
                    aria-label="Stop generation"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    Stop
                  </button>
                ) : isGenerating ? (
                  <div className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-[#A0A0A0]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating…
                  </div>
                ) : (
                  <button
                    onClick={onSubmit}
                    disabled={!value.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ECECEC]/40"
                    style={value.trim() ? { backgroundColor: "#ECECEC" } : { backgroundColor: "#303030" }}
                    aria-label="Send (Enter)"
                  >
                    <ArrowUp
                      className="h-3.5 w-3.5"
                      style={{ color: value.trim() ? "#202020" : "#A0A0A0" }}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — keyboard hint and status */}
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setShowAttachMenu(v => !v)}
            disabled={busy}
            className="flex items-center gap-1 text-[10px] text-[#A0A0A0]/70 transition-colors hover:text-[#A0A0A0] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ECECEC]/30 rounded"
          >
            <Plus className="h-3 w-3" />
            Attach
          </button>

          {isGenerating ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-400/70">Generating…</span>
            </div>
          ) : isRunning ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ECECEC]/50 animate-pulse" />
              <span className="text-[10px] text-[#A0A0A0]">Working…</span>
            </div>
          ) : (
            <span className="text-[10px] text-[#A0A0A0]/60">Enter to send · Shift + Enter for new line</span>
          )}

          <span
            className={`text-[10px] font-medium ${
              isGenerating
                ? "text-amber-400/70"
                : isRunning
                ? "text-[#A0A0A0]"
                : "text-emerald-400/60"
            }`}
          >
            {isGenerating ? "Generating…" : isRunning ? "Working…" : "Ready"}
          </span>
        </div>
      </div>
    </>
  )
}
