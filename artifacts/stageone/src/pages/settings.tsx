import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import {
  ArrowLeft,
  User,
  Bell,
  Database,
  Trash2,
  Save,
  Check,
  LogOut,
  HeadphonesIcon,
  Plus,
  X,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Gift,
  Copy,
  ExternalLink,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { AppSidebar } from "@/components/dashboard/app-sidebar"

const CATEGORY_OPTIONS = [
  { value: "billing", label: "Billing" },
  { value: "account", label: "Account" },
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
]

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const STATUS_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  open:         { color: "#6366F1", label: "Open",          icon: AlertCircle },
  in_progress:  { color: "#F59E0B", label: "In Progress",   icon: Clock },
  waiting_user: { color: "#8B5CF6", label: "Waiting Reply", icon: Clock },
  resolved:     { color: "#10B981", label: "Resolved",      icon: CheckCircle2 },
  closed:       { color: "#6B7280", label: "Closed",        icon: CheckCircle2 },
}

interface Ticket {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  senderType: string
  senderName?: string | null
  message: string
  createdAt: string
}

interface TicketDetail {
  ticket: Ticket
  messages: Message[]
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [, setLocation] = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [projectCount, setProjectCount] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [emailUpdates, setEmailUpdates] = useState(true)

  // Referral state
  const [referralData, setReferralData] = useState<{
    referralCode: string
    referralLink: string
    referralCount: number
    totalBonusGenerations: number
  } | null>(null)
  const [referralCopied, setReferralCopied] = useState(false)

  // Support Center state
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [newTicket, setNewTicket] = useState({ subject: "", category: "technical", priority: "medium", message: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [supportTab, setSupportTab] = useState<"list" | "new" | "detail">("list")

  useEffect(() => {
    const prefs = localStorage.getItem("stageone-prefs")
    if (prefs) {
      try {
        const p = JSON.parse(prefs)
        setEmailUpdates(p.emailUpdates ?? true)
      } catch { /* ignore */ }
    }
    api.projects.list().then(({ projects }) => setProjectCount(projects.length)).catch(() => {})
    api.referrals.getMyLink().then(setReferralData).catch(() => {})
    loadTickets()
  }, [])

  const loadTickets = async () => {
    try {
      const data = await api.support.listTickets()
      setTickets((data.tickets as unknown as Ticket[]) ?? [])
    } catch { /* ignore */ }
  }

  const handleCreateTicket = async () => {
    setSubmitError(null)
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      setSubmitError("Subject and message are required")
      return
    }
    setSubmitting(true)
    try {
      await api.support.createTicket(newTicket)
      setNewTicket({ subject: "", category: "technical", priority: "medium", message: "" })
      setShowNewTicket(false)
      setSupportTab("list")
      await loadTickets()
    } catch (err) {
      setSubmitError((err as Error).message ?? "Failed to submit ticket")
    }
    setSubmitting(false)
  }

  const handleViewTicket = async (ticketId: string) => {
    setLoadingTicket(true)
    setSupportTab("detail")
    try {
      const data = await api.support.getTicket(ticketId)
      setSelectedTicket(data as unknown as TicketDetail)
    } catch { /* ignore */ }
    setLoadingTicket(false)
  }

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket?.ticket) return
    setSendingReply(true)
    try {
      await api.support.replyToTicket(selectedTicket.ticket.id, replyText)
      setReplyText("")
      await handleViewTicket(selectedTicket.ticket.id)
      await loadTickets()
    } catch { /* ignore */ }
    setSendingReply(false)
  }

  const handleSave = () => {
    localStorage.setItem("stageone-prefs", JSON.stringify({ emailUpdates }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSignOut = async () => {
    await logout()
    setLocation("/")
  }

  const SettingSection = ({
    icon: Icon,
    title,
    description,
    children,
  }: {
    icon: typeof User
    title: string
    description: string
    children: React.ReactNode
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      </div>
    </motion.div>
  )

  const Toggle = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean
    onChange: (v: boolean) => void
    label: string
  }) => (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary"}`}
      >
        <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  )

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 shrink-0">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Profile */}
            <SettingSection icon={User} title="Profile" description="Your account information">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm">
                    {user?.name ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm">
                    {user?.email ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-muted-foreground text-sm">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                  </div>
                </div>
              </div>
            </SettingSection>

            {/* Notifications */}
            <SettingSection icon={Bell} title="Notifications" description="Control your notification preferences">
              <Toggle checked={emailUpdates} onChange={setEmailUpdates} label="Email updates about new features" />
            </SettingSection>

            {/* Referral Program */}
            <SettingSection icon={Gift} title="Refer Friends" description="Earn +5 free AI generations for every signup">
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {referralData ? (
                        <>
                          <span className="text-primary text-lg">{referralData.referralCount}</span>
                          {" "}referral{referralData.referralCount !== 1 ? "s" : ""}
                        </>
                      ) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {referralData
                        ? `+${referralData.totalBonusGenerations} bonus generations earned`
                        : "Loading…"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Your code</p>
                    <p className="text-sm font-mono font-bold text-primary tracking-widest">
                      {referralData?.referralCode ?? "—"}
                    </p>
                  </div>
                </div>

                {referralData && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Your referral link</label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-xs font-mono truncate">
                        {referralData.referralLink}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralData.referralLink).catch(() => {})
                          setReferralCopied(true)
                          setTimeout(() => setReferralCopied(false), 2000)
                        }}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          referralCopied
                            ? "bg-green-500/10 border-green-500/30 text-green-400"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                        }`}
                      >
                        {referralCopied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Share your link with friends. When they sign up, you both benefit — they get access to STAGEONE and you earn +5 free AI generations per referral, credited immediately.
                </p>
              </div>
            </SettingSection>

            {/* Data */}
            <SettingSection icon={Database} title="Data Management" description="Your saved projects and data">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Saved Projects</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {projectCount === null ? "Loading…" : `${projectCount} project${projectCount !== 1 ? "s" : ""} in your account`}
                  </p>
                </div>
              </div>
            </SettingSection>

            {/* Support Center */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <HeadphonesIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Support Center</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Submit and track your support requests</p>
                    </div>
                    {supportTab !== "new" && (
                      <button
                        onClick={() => setSupportTab("new")}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New Ticket
                      </button>
                    )}
                  </div>

                  <div className="mt-4">
                    {/* New Ticket Form */}
                    {supportTab === "new" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">Submit a New Ticket</p>
                          <button onClick={() => setSupportTab("list")} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</label>
                          <input
                            type="text"
                            value={newTicket.subject}
                            onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
                            placeholder="Brief description of your issue"
                            className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground uppercase tracking-wider">Category</label>
                            <select
                              value={newTicket.category}
                              onChange={e => setNewTicket(p => ({ ...p, category: e.target.value }))}
                              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                            >
                              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground uppercase tracking-wider">Priority</label>
                            <select
                              value={newTicket.priority}
                              onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}
                              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                            >
                              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wider">Message</label>
                          <textarea
                            value={newTicket.message}
                            onChange={e => setNewTicket(p => ({ ...p, message: e.target.value }))}
                            placeholder="Describe your issue in detail..."
                            rows={4}
                            className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                          />
                        </div>
                        {submitError && (
                          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{submitError}</p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSupportTab("list")}
                            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateTicket}
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {submitting ? "Submitting…" : "Submit Ticket"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ticket Detail */}
                    {supportTab === "detail" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={() => setSupportTab("list")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to tickets
                          </button>
                        </div>
                        {loadingTicket ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
                        ) : selectedTicket ? (
                          <>
                            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1.5">
                              <p className="text-sm font-semibold text-foreground">{selectedTicket.ticket.subject}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {(() => {
                                  const sm = STATUS_META[selectedTicket.ticket.status] ?? STATUS_META.open
                                  const Icon = sm.icon
                                  return (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                      style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}30` }}>
                                      <Icon className="h-2.5 w-2.5" />
                                      {sm.label}
                                    </span>
                                  )
                                })()}
                                <span className="text-[10px] text-muted-foreground capitalize">{selectedTicket.ticket.category.replace("_", " ")}</span>
                                <span className="text-[10px] text-muted-foreground">{timeAgo(selectedTicket.ticket.createdAt)}</span>
                              </div>
                            </div>
                            {/* Messages */}
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                              {selectedTicket.messages.map(msg => {
                                const isAdmin = msg.senderType === "admin"
                                return (
                                  <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                                    <div className={`max-w-[85%] rounded-xl p-3 text-xs ${
                                      isAdmin
                                        ? "bg-secondary/40 border border-border/50 text-foreground"
                                        : "bg-primary/10 border border-primary/20 text-foreground"
                                    }`}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isAdmin ? "text-muted-foreground" : "text-primary"}`}>
                                          {isAdmin ? "Support Team" : "You"}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/50">{timeAgo(msg.createdAt)}</span>
                                      </div>
                                      <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {/* Reply */}
                            {selectedTicket.ticket.status !== "closed" && selectedTicket.ticket.status !== "resolved" && (
                              <div className="flex gap-2 pt-1">
                                <textarea
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  placeholder="Add a reply…"
                                  rows={2}
                                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/30 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                                />
                                <button
                                  onClick={handleReply}
                                  disabled={sendingReply || !replyText.trim()}
                                  className="px-3 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                                >
                                  <Send className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* Ticket List */}
                    {supportTab === "list" && (
                      <div className="space-y-2">
                        {tickets.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No support tickets yet.{" "}
                            <button onClick={() => setSupportTab("new")} className="text-primary hover:underline">
                              Submit your first ticket
                            </button>
                          </div>
                        ) : tickets.map(ticket => {
                          const sm = STATUS_META[ticket.status] ?? STATUS_META.open
                          const Icon = sm.icon
                          return (
                            <button
                              key={ticket.id}
                              onClick={() => handleViewTicket(ticket.id)}
                              className="w-full text-left p-3 rounded-lg bg-secondary/20 border border-border/50 hover:border-border hover:bg-secondary/30 transition-all group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                      style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}30` }}>
                                      <Icon className="h-2.5 w-2.5" />
                                      {sm.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground capitalize">{ticket.category.replace("_", " ")}</span>
                                    <span className="text-[10px] text-muted-foreground">{timeAgo(ticket.updatedAt)}</span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sign Out */}
            <SettingSection icon={LogOut} title="Account" description="Session management">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                Sign Out
              </button>
            </SettingSection>

            {/* Save */}
            <motion.div className="flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save Preferences</>}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
