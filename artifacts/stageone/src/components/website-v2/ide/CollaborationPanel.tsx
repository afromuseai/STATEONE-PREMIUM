// ─── Phase P6 — Collaboration Layer ────────────────────────────────────────────
// Implements:
//   P6.1 — Team Presence (online indicators, colored cursors)
//   P6.2 — Invite Developer (email invite → shareable link)
//   P6.3 — Shared AI Context (Marcus session visible to team)
//   P6.4 — Team Workspace (activity feed, recent changes)

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, UserPlus, Mail, Copy, Check, Link2,
  Circle, Brain, FileCode, Zap, Clock, Send,
  ChevronRight, MessageSquare, GitCommit, Eye,
  Sparkles, Shield, X,
} from "lucide-react"
import type { V2Project } from "@/hooks/useWebsiteV2Project"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collaborator {
  id:       string
  name:     string
  email:    string
  avatar:   string          // initials
  color:    string          // cursor / presence color
  status:   "online" | "away" | "offline"
  activity: string          // what they're doing
  file?:    string          // file they have open
  lastSeen: string
}

interface ActivityEvent {
  id:      string
  user:    string
  color:   string
  type:    "edit" | "comment" | "deploy" | "review" | "join" | "ai"
  message: string
  time:    string
}

interface CollaborationPanelProps {
  project: V2Project
}

// ─── Static demo data ─────────────────────────────────────────────────────────
// In a real implementation these would come from a presence WebSocket channel.

const DEMO_COLLABORATORS: Collaborator[] = [
  {
    id:       "you",
    name:     "You",
    email:    "",
    avatar:   "YO",
    color:    "#f59e0b",
    status:   "online",
    activity: "Editing",
    file:     "App.tsx",
    lastSeen: "now",
  },
]

const DEMO_FEED: ActivityEvent[] = [
  {
    id: "1", user: "You", color: "#f59e0b",
    type: "ai",     message: "Marcus rewrote HeroSection with gradient styles", time: "just now",
  },
  {
    id: "2", user: "You", color: "#f59e0b",
    type: "edit",   message: "Modified App.tsx", time: "2 min ago",
  },
  {
    id: "3", user: "You", color: "#f59e0b",
    type: "deploy", message: "Deployment pipeline started", time: "5 min ago",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: Collaborator["status"] }) {
  const cls = {
    online:  "bg-emerald-400 shadow-none",
    away:    "bg-[#252525]",
    offline: "bg-white/20",
  }[status]
  return <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#111] ${cls}`} />
}

function Avatar({ name, color, status }: { name: string; color: string; status: Collaborator["status"] }) {
  return (
    <div className="relative flex-shrink-0">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-black"
        style={{ background: color }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <StatusDot status={status} />
    </div>
  )
}

function FeedIcon({ type }: { type: ActivityEvent["type"] }) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    edit:    { icon: FileCode,       color: "text-blue-400/70"   },
    comment: { icon: MessageSquare,  color: "text-[#ECECEC]/40"      },
    deploy:  { icon: Zap,           color: "text-[#ECECEC]"  },
    review:  { icon: Eye,           color: "text-purple-400/70" },
    join:    { icon: UserPlus,      color: "text-emerald-400/70"},
    ai:      { icon: Sparkles,      color: "text-[#ECECEC]"     },
  }
  const { icon: Icon, color } = map[type] ?? map.edit
  return <Icon className={`h-3 w-3 flex-shrink-0 mt-0.5 ${color}`} />
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, action, onAction }: {
  label:    string
  action?:  string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#ECECEC]/25">
        {label}
      </span>
      {action && (
        <button
          onClick={onAction}
          className="font-mono text-[9px] text-[#ECECEC]/30 transition-colors hover:text-[#ECECEC]"
        >
          {action}
        </button>
      )}
    </div>
  )
}

// ─── Invite Form ──────────────────────────────────────────────────────────────

function InviteForm({ projectId }: { projectId: string | number }) {
  const [email,   setEmail]   = useState("")
  const [state,   setState]   = useState<"idle" | "sending" | "sent" | "link">("idle")
  const [link,    setLink]    = useState("")
  const [copied,  setCopied]  = useState(false)

  const handleSend = useCallback(async () => {
    if (!email.trim()) return
    setState("sending")
    // Simulate network — real impl would call POST /api/collaboration/invite
    await new Promise(r => setTimeout(r, 900))
    setLink(`https://stageone.app/join/${projectId}?invite=${btoa(email).slice(0, 12)}`)
    setState("sent")
  }, [email, projectId])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [link])

  const handleGenerateLink = useCallback(async () => {
    setState("sending")
    await new Promise(r => setTimeout(r, 600))
    setLink(`https://stageone.app/join/${projectId}?invite=open`)
    setState("link")
  }, [projectId])

  if (state === "sent" || state === "link") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
      >
        <div className="mb-2 flex items-center gap-1.5 text-emerald-400/90">
          <Check className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">
            {state === "sent" ? "Invite sent!" : "Link ready"}
          </span>
        </div>
        <p className="mb-2 text-[10px] text-[#ECECEC]/40 leading-relaxed">
          {state === "sent"
            ? `We sent an invite to ${email}. Share this link too:`
            : "Share this link with your collaborator:"}
        </p>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate rounded bg-[#252525] px-2 py-1 font-mono text-[9px] text-[#ECECEC]/40">
            {link}
          </div>
          <button
            onClick={handleCopy}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[#252525]
              text-[#ECECEC]/40 transition-colors hover:bg-[#252525] hover:text-[#ECECEC]"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <button
          onClick={() => { setState("idle"); setEmail(""); setLink("") }}
          className="mt-2 text-[9px] text-[#ECECEC]/25 transition-colors hover:text-[#ECECEC]/50"
        >
          Invite another →
        </button>
      </motion.div>
    )
  }

  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] p-3">
        {/* Email row */}
        <div className="mb-2 flex gap-1.5">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#ECECEC]/25" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend() }}
              placeholder="colleague@company.com"
              className="w-full rounded bg-[#252525] py-1.5 pl-6 pr-2 font-mono text-[11px]
                text-[#ECECEC] placeholder-white/20 outline-none ring-0
                transition-all focus:bg-[#252525] focus:ring-1 focus:ring-[rgba(255,255,255,0.08)]"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!email.trim() || state === "sending"}
            className="flex items-center gap-1 rounded bg-[#252525] px-2.5 py-1.5 text-[11px]
              font-semibold text-black transition-all hover:bg-[#ECECEC] text-[#1A1A1A]
              disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state === "sending"
              ? <span className="h-3 w-3 animate-spin rounded-full border border-black/40 border-t-black" />
              : <Send className="h-3 w-3" />}
          </button>
        </div>

        {/* Or link */}
        <button
          onClick={handleGenerateLink}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-[rgba(255,255,255,0.08)]
            bg-[#252525] py-1.5 text-[10px] text-[#ECECEC]/35 transition-colors
            hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC]/60"
        >
          <Link2 className="h-3 w-3" />
          Generate invite link
        </button>
      </div>
    </div>
  )
}

// ─── Shared AI Context ────────────────────────────────────────────────────────

function SharedContext({ project }: { project: V2Project }) {
  const fileCount = project.files.length
  const frameworks = Array.from(
    new Set(
      project.files
        .map(f => f.path.endsWith(".tsx") ? "React" : f.path.endsWith(".css") ? "CSS" : null)
        .filter(Boolean),
    ),
  ).slice(0, 3)

  const insights = [
    { icon: FileCode, label: `${fileCount} files indexed`, color: "text-blue-400/70" },
    { icon: Brain,    label: "Marcus context: active",     color: "text-[#ECECEC]" },
    { icon: GitCommit,label: "Branch: main",               color: "text-[#ECECEC]/35"     },
    { icon: Shield,   label: "Shared AI memory: on",       color: "text-emerald-400/70"},
  ]

  return (
    <div className="px-3 pb-3">
      <div className="space-y-1">
        {insights.map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-[#252525]">
            <Icon className={`h-3 w-3 flex-shrink-0 ${color}`} />
            <span className="font-mono text-[11px] text-[#ECECEC]/45">{label}</span>
          </div>
        ))}
        {frameworks.length > 0 && (
          <div className="flex items-center gap-2 rounded px-2 py-1">
            <Sparkles className="h-3 w-3 flex-shrink-0 text-[#ECECEC]" />
            <span className="font-mono text-[11px] text-[#ECECEC]/45">
              Stack: {frameworks.join(", ")}
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 px-2 font-mono text-[9px] leading-relaxed text-[#ECECEC]/20">
        All collaborators share the same Marcus AI context — edits, history, and project memory sync automatically.
      </p>
    </div>
  )
}

// ─── Live Cursor Legend ───────────────────────────────────────────────────────

function CursorLegend({ collaborators }: { collaborators: Collaborator[] }) {
  const online = collaborators.filter(c => c.status === "online")
  if (online.length < 2) return null
  return (
    <div className="mx-3 mb-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] p-2.5">
      <p className="mb-1.5 font-mono text-[9px] text-[#ECECEC]/25">Live cursors active in editor</p>
      <div className="flex flex-wrap gap-1.5">
        {online.map(c => (
          <div key={c.id} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
            <span className="font-mono text-[9px] text-[#ECECEC]/45">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function CollaborationPanel({ project }: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>(DEMO_COLLABORATORS)
  const [feed,          setFeed]          = useState<ActivityEvent[]>(DEMO_FEED)
  const [showInvite,    setShowInvite]    = useState(false)

  const onlineCount = collaborators.filter(c => c.status === "online").length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#1A1A1A] text-[#ECECEC]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[#ECECEC]" />
          <span className="text-[12px] font-semibold text-[#ECECEC]">Team</span>
          <span className="rounded-full bg-[#252525] px-1.5 py-px font-mono text-[9px] text-[#ECECEC]">
            {onlineCount} online
          </span>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          title="Invite collaborator"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors
            ${showInvite
              ? "bg-[#252525] text-[#ECECEC]"
              : "text-[#ECECEC]/30 hover:bg-[#252525] hover:text-[#ECECEC]/65"}`}
        >
          {showInvite ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* Invite form (expandable) */}
        <AnimatePresence initial={false}>
          {showInvite && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="overflow-hidden border-b border-[rgba(255,255,255,0.08)]"
            >
              <div className="pt-2">
                <SectionHeader label="Invite Developer" />
                <InviteForm projectId={project.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Present now ─────────────────────────────────────────────── */}
        <SectionHeader
          label="Present Now"
          action={collaborators.length > 1 ? "see all" : undefined}
        />

        <div className="px-3 pb-3 space-y-1">
          {collaborators.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[#252525]"
            >
              <Avatar name={c.avatar} color={c.color} status={c.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#ECECEC]">{c.name}</span>
                  {c.id === "you" && (
                    <span className="rounded bg-[#252525] px-1 font-mono text-[8px] text-[#ECECEC]/25">you</span>
                  )}
                </div>
                <p className="truncate font-mono text-[9px] text-[#ECECEC]/30">
                  {c.file ? `${c.activity} · ${c.file}` : c.activity}
                </p>
              </div>
              <div className="flex-shrink-0">
                <Circle
                  className="h-1.5 w-1.5"
                  style={{ fill: c.color, color: c.color }}
                />
              </div>
            </motion.div>
          ))}

          {/* Empty invite CTA when solo */}
          {collaborators.length === 1 && (
            <button
              onClick={() => setShowInvite(true)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border
                border-dashed border-[rgba(255,255,255,0.08)] py-3 text-[11px] text-[#ECECEC]/25
                transition-colors hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite a collaborator
            </button>
          )}
        </div>

        {/* Live cursor legend */}
        <CursorLegend collaborators={collaborators} />

        {/* ── Shared AI Context ─────────────────────────────────────────── */}
        <div className="border-t border-[rgba(255,255,255,0.08)]">
          <SectionHeader label="Shared AI Context" />
          <SharedContext project={project} />
        </div>

        {/* ── Activity feed ─────────────────────────────────────────────── */}
        <div className="border-t border-[rgba(255,255,255,0.08)]">
          <SectionHeader label="Team Activity" />
          <div className="px-3 pb-4 space-y-2.5">
            {feed.map(evt => (
              <div key={evt.id} className="flex gap-2">
                <FeedIcon type={evt.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-relaxed text-[#ECECEC]/50">
                    <span className="font-medium" style={{ color: evt.color }}>{evt.user}</span>
                    {" "}{evt.message}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-[#ECECEC]/20">{evt.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Coming soon: Real-time ─────────────────────────────────────── */}
        <div className="mx-3 mb-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[#ECECEC]/30">
            <Clock className="h-3 w-3" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest">
              Enterprise
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#ECECEC]/35">
            Live cursor sync, voice channels, and branched AI contexts are available on the Enterprise plan.
          </p>
          <button className="mt-2 flex items-center gap-1 text-[10px] text-[#ECECEC]
            transition-colors hover:text-[#ECECEC]">
            Learn more <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
