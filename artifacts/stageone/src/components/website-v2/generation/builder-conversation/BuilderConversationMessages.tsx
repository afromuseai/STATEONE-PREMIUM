// ─── Builder Conversation — presentational renderer ────────────────────────────
// Renders derived `BuilderConversationMessage`s inline in the chat, right
// alongside `GenerationActivity`. Deliberately minimal: no cards, no gold —
// neutral workspace theme (bg #202020, panels #232323, borders #303030,
// text #ECECEC/#A0A0A0). Color is reserved for status: emerald for the
// closing summary, red for warnings. Hierarchy between the four kinds comes
// from type weight and a left rule, not from boxes.

import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, GitBranch, Lightbulb } from "lucide-react"

import type { BuilderConversationMessage } from "./types"

const KIND_ICON: Record<BuilderConversationMessage["kind"], React.ElementType> = {
  explanation: Lightbulb,
  decision: GitBranch,
  warning: AlertTriangle,
  summary: CheckCircle2,
}

// Left rule + icon color per kind — the only color signal, reserved for status.
const KIND_ACCENT: Record<BuilderConversationMessage["kind"], string> = {
  explanation: "#303030",
  decision: "#A0A0A0",
  warning: "#ef4444",
  summary: "#10b981",
}

const KIND_ICON_COLOR: Record<BuilderConversationMessage["kind"], string> = {
  explanation: "text-[#A0A0A0]/70",
  decision: "text-[#A0A0A0]",
  warning: "text-red-400/80",
  summary: "text-emerald-400/80",
}

const KIND_LABEL: Record<BuilderConversationMessage["kind"], string> = {
  explanation: "Explanation",
  decision: "Decision",
  warning: "Heads up",
  summary: "Summary",
}

function MessageBody({ message }: { message: BuilderConversationMessage }) {
  switch (message.kind) {
    case "decision":
      return (
        <>
          <span className="font-medium text-[#ECECEC]">{message.decision}</span>
          {message.reason && <span className="mt-0.5 block text-[#A0A0A0]">{message.reason}</span>}
        </>
      )
    case "warning":
      return <span className="text-red-300/90">{message.text}</span>
    case "summary":
      return <span className="font-medium text-emerald-300/90">{message.text}</span>
    case "explanation":
      return <span className="text-[#A0A0A0]">{message.text}</span>
  }
}

export function BuilderConversationMessages({ messages }: { messages: BuilderConversationMessage[] }) {
  if (messages.length === 0) return null

  return (
    <div className="mt-2.5 space-y-2.5">
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const Icon = KIND_ICON[message.kind]
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex items-start gap-2.5 border-l-2 pl-2.5"
              style={{ borderColor: KIND_ACCENT[message.kind] }}
            >
              <Icon className={`mt-0.5 h-3 w-3 flex-shrink-0 ${KIND_ICON_COLOR[message.kind]}`} />
              <div className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-semibold uppercase tracking-wide text-[#A0A0A0]/70">
                  {KIND_LABEL[message.kind]}
                </span>
                <p className="mt-0.5 text-[11.5px] leading-relaxed">
                  <MessageBody message={message} />
                </p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
