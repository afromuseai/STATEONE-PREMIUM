import { motion, AnimatePresence } from "framer-motion"
import { FileCode, Plus, Trash2, RefreshCw } from "lucide-react"

export type ActivityOp = "update" | "create" | "delete"

export interface ActivityItem {
  id: string
  type: "file_change" | "phase" | "message"
  path?: string
  operation?: ActivityOp
  reason?: string
  phase?: string
  text?: string
  timestamp: number
}

const OP_CONFIG: Record<ActivityOp, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  update: { color: "#60a5fa", bg: "#60a5fa18", icon: RefreshCw, label: "Updated" },
  create: { color: "#34d399", bg: "#34d39918", icon: Plus,      label: "Created" },
  delete: { color: "#f87171", bg: "#f8717118", icon: Trash2,    label: "Deleted" },
}

function FileChangeItem({ item }: { item: ActivityItem }) {
  if (!item.path || !item.operation) return null
  const cfg = OP_CONFIG[item.operation]
  const Icon = cfg.icon
  const fileName = item.path.split("/").pop() ?? item.path

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] px-2.5 py-2 text-[11px]">
      <div
        className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
        style={{ background: cfg.bg }}
      >
        <Icon className="h-2.5 w-2.5" style={{ color: cfg.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <FileCode className="h-3 w-3 flex-shrink-0 text-blue-400/70" />
          <span className="truncate font-mono font-semibold text-[#ECECEC]">{fileName}</span>
          <span
            className="ml-auto flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        {item.reason && (
          <p className="mt-0.5 truncate text-[#ECECEC]/35">{item.reason}</p>
        )}
      </div>
    </div>
  )
}

function PhaseItem({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <div className="h-px flex-1 bg-[#252525]" />
      <span className="text-[#ECECEC]/30">{item.phase}</span>
      <div className="h-px flex-1 bg-[#252525]" />
    </div>
  )
}

interface AgentActivityProps {
  items: ActivityItem[]
}

export function AgentActivity({ items }: AgentActivityProps) {
  if (items.length === 0) return null

  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {item.type === "file_change" && <FileChangeItem item={item} />}
            {item.type === "phase" && <PhaseItem item={item} />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
