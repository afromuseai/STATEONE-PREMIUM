// ─── Builder Conversation — presentational renderer ────────────────────────────
// Renders derived `BuilderConversationMessage`s inline in the chat, right
// alongside `GenerationActivity`. Deliberately minimal: no cards, no gold —
// same neutral gray palette as the rest of AgentConversation
// (`#ECECEC` / `#A0A0A0`), with the existing emerald/red accents already used
// elsewhere for success/error, never a new color.

import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, GitBranch, Lightbulb } from "lucide-react"

import type { BuilderConversationMessage } from "./types"

const KIND_ICON: Record<BuilderConversationMessage["kind"], React.ElementType> = {
  explanation: Lightbulb,
  decision: GitBranch,
  warning: AlertTriangle,
  summary: CheckCircle2,
}

const KIND_ICON_COLOR: Record<BuilderConversationMessage["kind"], string> = {
  explanation: "text-[#A0A0A0]/60",
  decision: "text-[#A0A0A0]/60",
  warning: "text-red-400/70",
  summary: "text-emerald-400/70",
}

function MessageBody({ message }: { message: BuilderConversationMessage }) {
  switch (message.kind) {
    case "decision":
      return (
        <>
          <span className="text-[#ECECEC]/80">{message.decision}</span>
          {message.reason && <span className="mt-0.5 block text-[#A0A0A0]">{message.reason}</span>}
        </>
      )
    case "warning":
      return <span className="text-red-300/80">{message.text}</span>
    case "summary":
      return <span className="text-emerald-300/80">{message.text}</span>
    case "explanation":
      return <span className="text-[#A0A0A0]">{message.text}</span>
  }
}

export function BuilderConversationMessages({ messages }: { messages: BuilderConversationMessage[] }) {
  if (messages.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const Icon = KIND_ICON[message.kind]
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex items-start gap-2"
            >
              <Icon className={`mt-0.5 h-3 w-3 flex-shrink-0 ${KIND_ICON_COLOR[message.kind]}`} />
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed">
                <MessageBody message={message} />
              </p>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
