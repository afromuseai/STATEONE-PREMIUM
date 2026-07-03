import React, { useState, useEffect, useCallback, useRef } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, Users, BarChart3, Crown, Zap, Building2,
  Trash2, ChevronDown, RefreshCw, Search, UserCheck,
  TrendingUp, Globe, Bot, X, Check, AlertTriangle,
  Radio, Activity, Megaphone, MapPin, Funnel,
  Send, Clock, ArrowDown, ArrowUp, Mail, Eye, FolderOpen,
  DollarSign, CreditCard, Tag, FileText, ListFilter,
  Pause, Play, Plus, Percent, Hash, Calendar, ChevronUp,
  BadgeCheck, UserX, ToggleLeft, ToggleRight, Monitor, Wifi,
  ClipboardList, ChevronRight, Target, Layers, Star, Cpu, TrendingDown,
  Database, CheckCircle2, Circle, AlertCircle, Flame,
  Download, Edit, Flag,
} from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import stageoneIcon from "@/assets/stageone-icon.png"
import { useImpersonation } from "@/lib/impersonation-context"
import { GeoWorldMap } from "@/components/dashboard/geo-world-map"
import { AdminFeatureFlags } from "@/components/dashboard/admin-feature-flags"
import { AdminSystemHealth } from "@/components/dashboard/admin-system-health"
import { AdminAiModels } from "@/components/dashboard/admin-ai-models"
import { AdminSecurity } from "@/components/dashboard/admin-security"
import { AdminIncidents } from "@/components/dashboard/admin-incidents"
import { AdminBackups } from "@/components/dashboard/admin-backups"

type Plan = "free" | "pro" | "startup" | "enterprise"
type AdminTab = "users" | "stats" | "billing" | "billing-intel" | "events" | "analytics" | "intelligence" | "messages" | "broadcasts" | "waitlist" | "coupons" | "audit" | "sessions" | "audit-logs" | "geo" | "support" | "impersonation-logs" | "crm" | "acquisition" | "feature-flags" | "system-health" | "ai-models" | "security" | "incidents" | "backups" | "pipeline"

interface AdminUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
  country?: string | null
  city?: string | null
  lastSeenAt?: string | null
  createdAt: string
  subscription: {
    plan: Plan
    status: string
    aiGenerationsUsed: number
    aiGenerationsLimit: number
    deploymentsUsed: number
    deploymentsLimit: number
    currentPeriodEnd: string
  } | null
}

interface Stats {
  totalUsers: number
  admins: number
  planCounts: Record<string, number>
  totalGenerations: number
}

interface AdminEvent {
  id: string
  type: string
  userId: string | null
  projectId: string | null
  country: string | null
  city: string | null
  ip: string | null
  createdAt: string
  userEmail: string | null
  userName: string | null
}

interface Analytics {
  overview: {
    totalUsers: number
    activeUsers24h: number
    activeUsers7d: number
    activeUsers30d: number
    totalEvents: number
    totalProjects: number
    totalGenerations: number
    totalMarcusMessages: number
  }
  funnel: Array<{ stage: string; count: number; pct: number }>
  geo: Array<{ country: string | null; users: number }>
  topCities: Array<{ city: string | null; users: number }>
  eventTypes: Array<{ type: string; total: number }>
  recentEvents: AdminEvent[]
  dailySignups: Array<{ date: string; signups: number }>
  topUsers: Array<{ userId: string | null; email: string | null; name: string | null; total: number }>
}

interface PipelineModuleStat {
  type: string
  total: number
  last24h: number
  last7d: number
  last_at: string | null
}

interface PipelineEvent extends AdminEvent {
  data?: Record<string, unknown> | null
}

interface PipelineData {
  moduleStats: PipelineModuleStat[]
  recentEvents: PipelineEvent[]
  trend: Array<{ date: string; type: string; count: number }>
}

interface GeoIntelligence {
  overview: {
    totalCountries: number
    totalCities: number
    topCountry: string
    topCity: string
    topTimezone: string
  }
  countries: Array<{ country: string; users: number; sessions: number; activeUsers: number }>
  cities: Array<{ city: string; country: string; users: number; sessions: number; activeUsers: number }>
  timezones: Array<{ timezone: string; users: number; sessions: number }>
  growth: Array<{ country: string; newUsers: number }>
}

interface IntelligenceUser {
  id: string
  email: string
  name: string
  country?: string | null
  city?: string | null
  lastSeenAt?: string | null
  createdAt: string
  plan: string
  projectCount: number
  biGenerations: number
  websiteGenerations: number
  chatbotGenerations: number
  automationGenerations: number
  orchestratorGenerations: number
  marcusMessages: number
  activityScore: number
}

interface MonitorSession {
  id: string
  userId: string
  startedAt: string
  lastSeenAt: string
  endedAt: string | null
  isActive: boolean
  isOnline: boolean
  durationMs: number
  country: string | null
  city: string | null
  device: string | null
  browser: string | null
  os: string | null
  currentPage: string | null
  lastAction: string | null
  userEmail: string | null
  userName: string | null
  plan: string | null
}

interface SessionData {
  sessions: MonitorSession[]
  stats: {
    activeNow: number
    sessionsToday: number
    avgDurationMs: number
    peakConcurrent: number
  }
}

interface Broadcast {
  id: string
  title: string
  message: string
  type: string
  target: string
  createdAt: string
  expiresAt: string | null
  deliveredCount?: number
  emailDelivered?: boolean
}

interface SegmentCounts {
  all: number
  free: number
  pro: number
  startup: number
  enterprise: number
  emailEnabled: boolean
}

interface BillingData {
  mrr: number
  arr: number
  totalUsers: number
  activeSubs: number
  planCounts: Record<string, number>
  paidUsers: number
  freeUsers: number
  conversionRate: number
  upgradeRate30d: number
  downgradeRate30d: number
}

interface BillingCharts {
  dailySignups: Array<{ date: string; count: number }>
  planDistribution: Record<string, number>
}

interface BIRevenueRow {
  plan: string
  users: number
  revenuePerUser: number
  totalRevenue: number
  share: number
}
interface BIRevenue {
  breakdown: BIRevenueRow[]
  mrr: number
  arr: number
}

interface BIFunnelStage { stage: string; count: number; pct: number }
interface BIFunnelConversion { from: string; to: string; count: number; rate: number }
interface BIFunnel {
  stages: BIFunnelStage[]
  conversions: BIFunnelConversion[]
}

interface BIUsageRow {
  plan: string
  userCount: number
  totalBiGenerations: number
  totalWebsiteGenerations: number
  totalChatbotGenerations: number
  totalAutomationGenerations: number
  totalMarcusMessages: number
  totalGenerations: number
  avgBiPerUser: number
  avgWebsitePerUser: number
  avgGenerationsPerUser: number
}
interface BIUsage { economics: BIUsageRow[] }

interface BIPowerUser {
  userId: string
  email: string
  name: string
  plan: string
  currentMrr: number
  totalGenerations: number
  biGenerations: number
  websiteGenerations: number
  marcusMessages: number
  projectCount: number
  aiUsedPct: number
  activityScore: number
  upgradeLikelihood: number
  lastSeen: string | null
}
interface BIPowerUsers { users: BIPowerUser[] }

interface BIReadinessCheck { id: string; label: string; status: "ready" | "pending" | "not_started"; detail: string }
interface BIReadiness {
  checks: BIReadinessCheck[]
  readinessPct: number
  readyCount: number
  totalChecks: number
  mrr: number
  paidUsers: number
  totalUsers: number
}

interface WaitlistEntry {
  id: string
  name: string
  email: string
  plan: string
  createdAt: string
}

interface AcquisitionProfile {
  id: string
  email: string
  name: string | null
  company: string | null
  source: string
  referralCode: string | null
  referredBy: string | null
  status: "waitlisted" | "invited" | "signed_up" | "converted"
  notes: string | null
  conversionScore: number
  userId: string | null
  invitedAt: string | null
  signedUpAt: string | null
  convertedAt: string | null
  createdAt: string
}

interface AcquisitionOverview {
  total: number
  waitlisted: number
  invited: number
  signedUp: number
  converted: number
  conversionRate: number
  signupRate: number
}

interface AcquisitionSource {
  source: string
  total: number
  signedUp: number
  converted: number
}

interface AcquisitionFunnelStage {
  stage: string
  count: number
  pct: number
  dropOff: number
}

interface AcquisitionReferrer {
  email: string
  referralCount: number
  signupCount: number
  conversionCount: number
}

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  maxUses: number | null
  uses: number
  expiresAt: string | null
  disabled: boolean
  description: string | null
  createdAt: string
  creatorName: string | null
}

interface AdminAuditLog {
  id: string
  adminId: string
  adminEmail: string
  action: string
  targetUserId: string | null
  targetUserEmail: string | null
  details: Record<string, unknown>
  ipHash: string | null
  createdAt: string
}

interface SupportTicket {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  userId: string
  assignedAdminId: string | null
  createdAt: string
  updatedAt: string
  userEmail: string | null
  userName: string | null
}

interface SupportMessageRow {
  id: string
  ticketId: string
  senderId: string
  senderType: string
  message: string
  createdAt: string
  senderName: string | null
  senderEmail: string | null
}

interface SupportTicketDetail {
  ticket: SupportTicket
  messages: SupportMessageRow[]
  owner: { name: string; email: string } | null
  assignedAdmin: { name: string; email: string } | null
}

interface SupportMetrics {
  open: number
  urgent: number
  resolved: number
  closed: number
  total: number
  recentOpen30d: number
  byCategory: Array<{ category: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
}

interface AuditLog {
  id: string
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  changes: Record<string, unknown> | null
  severity: string
  outcome: string
  ipAddress: string | null
  createdAt: string
  userEmail: string | null
  userName: string | null
}

interface ImpersonationLog {
  id: string
  adminId: string
  adminEmail: string | null
  adminName: string | null
  targetUserId: string
  targetEmail: string | null
  targetName: string | null
  action: string
  reason: string | null
  ipHash: string | null
  ipHashMasked: string | null
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  isActive: boolean
}
interface ImpersonationStats {
  totalSessions: number
  activeSessions: number
  uniqueAdmins: number
  uniqueTargets: number
  avgDurationMs: number | null
}

type CrmLifecycle = "new" | "activated" | "engaged" | "power_user" | "at_risk" | "churned"

interface CrmProfile {
  id: string
  userId: string
  lifecycleStage: CrmLifecycle
  engagementScore: number
  activityScore: number
  valueScore: number
  churnRiskScore: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastGenerationAt: string | null
  tags: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CrmUser {
  id: string
  email: string
  name: string
  country: string | null
  createdAt: string
  lastSeenAt: string | null
  plan: string
  crm: CrmProfile | null
}

interface CrmOverview {
  totalUsers: number
  newUsers: number
  activatedUsers: number
  engagedUsers: number
  powerUsers: number
  atRiskUsers: number
  churnedUsers: number
  profiledUsers: number
}

interface CrmUserDetail {
  user: { id: string; email: string; name: string; country: string | null; city: string | null; createdAt: string; lastSeenAt: string | null }
  subscription: { plan: string; status: string } | null
  crm: CrmProfile | null
  stats: {
    totalGenerations: number
    biGenerations: number
    websiteGenerations: number
    chatbotGenerations: number
    automationGenerations: number
    marcusMessages: number
    projectCount: number
    sessionCount: number
    supportTickets: number
  }
  timeline: Array<{ id: string; type: string; createdAt: string }>
  insights: string[]
}

interface MessageCenterSend {
  id: string
  adminId: string
  adminEmail: string
  title: string
  message: string
  type: string
  segment: string
  targetUserId: string | null
  recipientCount: number
  createdAt: string
}

interface NotifSchedule {
  id: string
  title: string
  message: string
  type: string
  segment: string
  targetUserId: string | null
  scheduledFor: string
  status: string
  createdBy: string | null
  sentAt: string | null
  createdAt: string
}

interface NotifAnalytics {
  totalSent: number
  totalRead: number
  unreadCount: number
  readRate: number
  topNotifications: Array<{
    title: string
    type: string
    recipients: number
    reads: number
    readRate: number
  }>
}

const PLAN_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  free:       { icon: Zap,       color: "#10B981", label: "Free" },
  pro:        { icon: Crown,     color: "#D4AF37", label: "Pro" },
  startup:    { icon: TrendingUp, color: "#F97316", label: "Startup" },
  enterprise: { icon: Building2, color: "#8B5CF6", label: "Enterprise" },
}

const EVENT_TYPE_META: Record<string, { color: string; label: string }> = {
  user_login:            { color: "#6366F1", label: "Login" },
  user_signup:           { color: "#10B981", label: "Signup" },
  user_logout:           { color: "#6B7280", label: "Logout" },
  project_created:       { color: "#D4AF37", label: "Project" },
  project_opened:        { color: "#FBBF24", label: "Opened" },
  bi_generated:          { color: "#F59E0B", label: "BI Gen" },
  website_generated:     { color: "#8B5CF6", label: "Website" },
  chatbot_generated:     { color: "#EC4899", label: "Chatbot" },
  automation_created:    { color: "#F97316", label: "Automation" },
  orchestrator_generated:{ color: "#7C3AED", label: "Orchestrator" },
  marcus_message:        { color: "#06B6D4", label: "Marcus" },
  marcus_task_created:   { color: "#0EA5E9", label: "Task" },
}

const BROADCAST_TYPE_META: Record<string, { color: string; label: string }> = {
  info:    { color: "#6366F1", label: "Info" },
  warning: { color: "#F59E0B", label: "Warning" },
  update:  { color: "#10B981", label: "Update" },
  feature: { color: "#D4AF37", label: "Feature" },
}

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  low:      { color: "#6B7280", label: "Low" },
  medium:   { color: "#F59E0B", label: "Medium" },
  high:     { color: "#F97316", label: "High" },
  critical: { color: "#EF4444", label: "Critical" },
}

const ACTION_META: Record<string, { color: string; label: string }> = {
  plan_change:         { color: "#D4AF37", label: "Plan Change" },
  plan_suspend:        { color: "#EF4444", label: "Suspend" },
  plan_reactivate:     { color: "#10B981", label: "Reactivate" },
  coupon_create:       { color: "#8B5CF6", label: "Coupon Created" },
  coupon_disable:      { color: "#F97316", label: "Coupon Disabled" },
  coupon_enable:       { color: "#10B981", label: "Coupon Enabled" },
  coupon_delete:       { color: "#EF4444", label: "Coupon Deleted" },
  message_center_send: { color: "#6366F1", label: "Message Sent" },
  waitlist_remove:     { color: "#6B7280", label: "Waitlist Remove" },
}

function PlanBadge({ plan }: { plan: Plan }) {
  const meta = PLAN_META[plan] ?? PLAN_META.free
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const meta = EVENT_TYPE_META[type] ?? { color: "#6B7280", label: type }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold font-mono"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.low
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { color: "#6B7280", label: action.replace(/_/g, " ") }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌍"
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—"
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/2 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
    </motion.div>
  )
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [, setLocation] = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [segmentCounts, setSegmentCounts] = useState<SegmentCounts | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<AdminTab>("users")
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [liveEvents, setLiveEvents] = useState<AdminEvent[]>([])
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", type: "info", target: "all" })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastSent, setBroadcastSent] = useState(false)
  const [intelligence, setIntelligence] = useState<IntelligenceUser[] | null>(null)
  const [intelligenceSearch, setIntelligenceSearch] = useState("")
  const [intelligenceSort, setIntelligenceSort] = useState<"activityScore" | "createdAt" | "projectCount" | "biGenerations">("activityScore")
  const [intelligenceFilter, setIntelligenceFilter] = useState<"all" | "active" | "inactive" | "power" | "paid" | "new">("all")
  const [msgForm, setMsgForm] = useState({ target: "all", targetUserId: "", type: "announcement", title: "", body: "" })
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [messageSends, setMessageSends] = useState<MessageCenterSend[]>([])
  const [notifAnalytics, setNotifAnalytics] = useState<NotifAnalytics | null>(null)
  const [schedules, setSchedules] = useState<NotifSchedule[]>([])
  const [scheduleForm, setScheduleForm] = useState({ title: "", message: "", type: "announcement", segment: "all", scheduledFor: "" })
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [deletingMsgSend, setDeletingMsgSend] = useState<string | null>(null)
  const [viewingMsg, setViewingMsg] = useState<string | null>(null)
  const [cancellingSchedule, setCancellingSchedule] = useState<string | null>(null)

  // Billing
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [billingCharts, setBillingCharts] = useState<BillingCharts | null>(null)
  const [billingRange, setBillingRange] = useState<"7d" | "30d" | "90d" | "all">("30d")
  const [suspendingUser, setSuspendingUser] = useState<string | null>(null)

  // Billing Intelligence
  const [biRevenue, setBiRevenue] = useState<BIRevenue | null>(null)
  const [biFunnel, setBiFunnel] = useState<BIFunnel | null>(null)
  const [biUsage, setBiUsage] = useState<BIUsage | null>(null)
  const [biPowerUsers, setBiPowerUsers] = useState<BIPowerUsers | null>(null)
  const [biReadiness, setBiReadiness] = useState<BIReadiness | null>(null)
  const [biIntelLoading, setBiIntelLoading] = useState(false)
  const [biSection, setBiSection] = useState<"overview" | "revenue" | "distribution" | "funnel" | "usage" | "power" | "readiness">("overview")

  // Waitlist
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [waitlistFilter, setWaitlistFilter] = useState<string>("all")
  const [deletingWaitlist, setDeletingWaitlist] = useState<string | null>(null)

  // Acquisition Intelligence
  const [acqOverview, setAcqOverview] = useState<AcquisitionOverview | null>(null)
  const [acqSources, setAcqSources] = useState<AcquisitionSource[]>([])
  const [acqFunnel, setAcqFunnel] = useState<AcquisitionFunnelStage[]>([])
  const [acqReferrers, setAcqReferrers] = useState<AcquisitionReferrer[]>([])
  const [acqUsers, setAcqUsers] = useState<AcquisitionProfile[]>([])
  const [acqLoading, setAcqLoading] = useState(false)
  const [acqSyncing, setAcqSyncing] = useState(false)
  const [acqStatusFilter, setAcqStatusFilter] = useState("all")
  const [acqSourceFilter, setAcqSourceFilter] = useState("all")
  const [acqSearch, setAcqSearch] = useState("")
  const [acqSort, setAcqSort] = useState<"createdAt" | "conversionScore">("createdAt")
  const [acqSortDir, setAcqSortDir] = useState<"desc" | "asc">("desc")
  const [acqEditUser, setAcqEditUser] = useState<AcquisitionProfile | null>(null)
  const [acqEditNotes, setAcqEditNotes] = useState("")
  const [acqEditStatus, setAcqEditStatus] = useState("")
  const [acqEditSource, setAcqEditSource] = useState("")
  const [acqSaving, setAcqSaving] = useState(false)
  const [acqInviting, setAcqInviting] = useState<string | null>(null)
  const [acqSection, setAcqSection] = useState<"overview" | "funnel" | "sources" | "referrals" | "users">("overview")

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponForm, setCouponForm] = useState({ code: "", type: "percentage", value: "", maxUses: "", expiresAt: "", description: "" })
  const [creatingCoupon, setCreatingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponSuccess, setCouponSuccess] = useState(false)
  const [showCouponForm, setShowCouponForm] = useState(false)

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditAction, setAuditAction] = useState("all")
  const [auditSeverity, setAuditSeverity] = useState("all")
  const [auditSearch, setAuditSearch] = useState("")

  // Admin Audit Logs
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([])
  const [adminAuditTotal, setAdminAuditTotal] = useState(0)
  const [adminAuditPage, setAdminAuditPage] = useState(0)
  const [adminAuditSearch, setAdminAuditSearch] = useState("")
  const [adminAuditAction, setAdminAuditAction] = useState("all")
  const [adminAuditFrom, setAdminAuditFrom] = useState("")
  const [adminAuditTo, setAdminAuditTo] = useState("")
  const [expandedAuditLog, setExpandedAuditLog] = useState<string | null>(null)

  // Session Monitor
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [sessionSearch, setSessionSearch] = useState("")
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all")
  const [sessionPlanFilter, setSessionPlanFilter] = useState("all")
  const [sessionActivity, setSessionActivity] = useState<AdminEvent[]>([])

  const { startImpersonation } = useImpersonation()
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null)
  const [impersonationReason, setImpersonationReason] = useState<Record<string, string>>({})
  const [impersonationError, setImpersonationError] = useState<string | null>(null)

  const handleImpersonate = async (targetUserId: string) => {
    setImpersonatingUserId(targetUserId)
    setImpersonationError(null)
    const reason = impersonationReason[targetUserId] ?? ""
    const result = await startImpersonation(targetUserId, reason)
    if (result.error) {
      setImpersonationError(result.error)
      setImpersonatingUserId(null)
    } else {
      setImpersonatingUserId(null)
      setLocation("/dashboard")
    }
  }

  // Geo Intelligence
  const [geoData, setGeoData] = useState<GeoIntelligence | null>(null)
  const [geoSearch, setGeoSearch] = useState("")
  const [geoView, setGeoView] = useState<"countries" | "cities" | "timezones" | "growth">("countries")

  // Support Desk
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(null)
  const [supportStatusFilter, setSupportStatusFilter] = useState("all")
  const [supportPriorityFilter, setSupportPriorityFilter] = useState("all")
  const [supportCategoryFilter, setSupportCategoryFilter] = useState("all")
  const [supportSearch, setSupportSearch] = useState("")
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetail | null>(null)
  const [ticketMessages, setTicketMessages] = useState<SupportMessageRow[]>([])
  const [supportReply, setSupportReply] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const [loadingTicket, setLoadingTicket] = useState(false)

  // CRM Intelligence
  const [crmOverview, setCrmOverview] = useState<CrmOverview | null>(null)
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmRecalculating, setCrmRecalculating] = useState(false)
  const [crmLifecycleFilter, setCrmLifecycleFilter] = useState<CrmLifecycle | "all">("all")
  const [crmPlanFilter, setCrmPlanFilter] = useState("all")
  const [crmSearch, setCrmSearch] = useState("")
  const [crmSort, setCrmSort] = useState<"churnRiskScore" | "engagementScore" | "valueScore" | "lastSeenAt">("churnRiskScore")
  const [crmSortDir, setCrmSortDir] = useState<"desc" | "asc">("desc")
  const [selectedCrmUser, setSelectedCrmUser] = useState<CrmUserDetail | null>(null)
  const [crmDrawerOpen, setCrmDrawerOpen] = useState(false)
  const [loadingCrmDetail, setLoadingCrmDetail] = useState(false)
  const [crmEditTags, setCrmEditTags] = useState<string[]>([])
  const [crmEditNotes, setCrmEditNotes] = useState("")
  const [crmEditLifecycle, setCrmEditLifecycle] = useState<CrmLifecycle>("new")
  const [crmSaving, setCrmSaving] = useState(false)
  const [crmTagInput, setCrmTagInput] = useState("")

  useEffect(() => {
    if (!user) { setLocation("/login"); return }
    if (!user.isAdmin) { setLocation("/dashboard"); return }
  }, [user])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersData, statsData] = await Promise.all([api.admin.getUsers(), api.admin.getStats()])
      setUsers(usersData.users as AdminUser[])
      setStats(statsData)
    } catch (_) {}
    setLoading(false)
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/analytics", { credentials: "include" }).then(r => r.json())
      if (data?.overview) setAnalytics(data)
    } catch (_) {}
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      const params = eventTypeFilter !== "all" ? `?type=${eventTypeFilter}` : ""
      const data = await fetch(`/api/admin/events${params}`, { credentials: "include" }).then(r => r.json())
      setEvents(data.events ?? [])
    } catch (_) {}
  }, [eventTypeFilter])

  const loadPipeline = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/pipeline", { credentials: "include" }).then(r => r.json())
      if (data?.recentEvents) setPipeline(data)
    } catch (_) {}
  }, [])

  const loadBroadcasts = useCallback(async () => {
    try {
      const [bData, sData] = await Promise.all([
        fetch("/api/admin/broadcasts", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/segment-counts", { credentials: "include" }).then(r => r.json()).catch(() => null),
      ])
      setBroadcasts(bData.broadcasts ?? [])
      if (sData) setSegmentCounts(sData)
    } catch (_) {}
  }, [])

  const loadIntelligence = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/user-intelligence", { credentials: "include" }).then(r => r.json())
      if (data?.users) setIntelligence(data.users)
    } catch (_) {}
  }, [])

  const loadBilling = useCallback(async () => {
    try {
      const [bData, cData] = await Promise.all([
        fetch("/api/admin/billing", { credentials: "include" }).then(r => r.json()),
        fetch(`/api/admin/billing/charts?range=${billingRange}`, { credentials: "include" }).then(r => r.json()),
      ])
      setBilling(bData)
      setBillingCharts(cData)
    } catch (_) {}
  }, [billingRange])

  const loadBillingIntelligence = useCallback(async () => {
    setBiIntelLoading(true)
    try {
      const sig = () => AbortSignal.timeout(12000)
      const [rev, funnel, usage, power, readiness] = await Promise.all([
        fetch("/api/admin/billing/revenue",         { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/billing/upgrade-funnel",  { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/billing/usage-economics", { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/billing/power-users",     { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/billing/readiness",       { credentials: "include", signal: sig() }).then(r => r.json()),
      ])
      setBiRevenue(rev)
      setBiFunnel(funnel)
      setBiUsage(usage)
      setBiPowerUsers(power)
      setBiReadiness(readiness)
    } catch (_) {}
    setBiIntelLoading(false)
  }, [])

  const loadWaitlist = useCallback(async () => {
    try {
      const params = waitlistFilter !== "all" ? `?plan=${waitlistFilter}` : ""
      const data = await fetch(`/api/admin/waitlist${params}`, { credentials: "include" }).then(r => r.json())
      setWaitlist(data.entries ?? [])
    } catch (_) {}
  }, [waitlistFilter])

  const loadAcquisition = useCallback(async () => {
    setAcqLoading(true)
    try {
      const sig = () => AbortSignal.timeout(12000)
      const [ov, src, fn, ref, us] = await Promise.all([
        fetch("/api/admin/acquisition/overview",  { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/acquisition/sources",   { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/acquisition/funnel",    { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch("/api/admin/acquisition/referrals", { credentials: "include", signal: sig() }).then(r => r.json()),
        fetch(`/api/admin/acquisition/users?status=${acqStatusFilter}&source=${acqSourceFilter}&search=${encodeURIComponent(acqSearch)}`, { credentials: "include", signal: sig() }).then(r => r.json()),
      ])
      setAcqOverview(ov ?? null)
      setAcqSources(src.sources ?? [])
      setAcqFunnel(fn.stages ?? [])
      setAcqReferrers(ref.referrers ?? [])
      setAcqUsers(us.users ?? [])
    } catch (_) {}
    setAcqLoading(false)
  }, [acqStatusFilter, acqSourceFilter, acqSearch])

  const handleAcqSync = async () => {
    setAcqSyncing(true)
    try {
      await fetch("/api/admin/acquisition/sync", { method: "POST", credentials: "include" })
      await loadAcquisition()
    } catch (_) {}
    setAcqSyncing(false)
  }

  const handleAcqInvite = async (id: string) => {
    setAcqInviting(id)
    try {
      await fetch(`/api/admin/acquisition/users/${id}/invite`, { method: "POST", credentials: "include" })
      await loadAcquisition()
    } catch (_) {}
    setAcqInviting(null)
  }

  const handleAcqSave = async () => {
    if (!acqEditUser) return
    setAcqSaving(true)
    try {
      await fetch(`/api/admin/acquisition/users/${acqEditUser.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ notes: acqEditNotes, status: acqEditStatus || undefined, source: acqEditSource || undefined }),
      })
      await loadAcquisition()
      setAcqEditUser(null)
    } catch (_) {}
    setAcqSaving(false)
  }

  const loadCoupons = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/coupons", { credentials: "include" }).then(r => r.json())
      setCoupons(data.coupons ?? [])
    } catch (_) {}
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const [sData, aData] = await Promise.all([
        fetch("/api/admin/sessions", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/events?limit=30", { credentials: "include" }).then(r => r.json()),
      ])
      if (sData?.sessions && sData?.stats) setSessionData(sData)
      if (aData?.events) setSessionActivity(aData.events)
    } catch (_) {}
  }, [])

  const loadAdminAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set("page", String(adminAuditPage))
      params.set("limit", "50")
      if (adminAuditAction !== "all") params.set("action", adminAuditAction)
      if (adminAuditSearch.trim()) params.set("search", adminAuditSearch.trim())
      if (adminAuditFrom) params.set("from", adminAuditFrom)
      if (adminAuditTo) params.set("to", adminAuditTo)
      const data = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" }).then(r => r.json())
      setAdminAuditLogs(data.logs ?? [])
      setAdminAuditTotal(data.total ?? 0)
    } catch (_) {}
  }, [adminAuditPage, adminAuditAction, adminAuditSearch, adminAuditFrom, adminAuditTo])

  const loadAudit = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (auditAction !== "all") params.set("action", auditAction)
      if (auditSeverity !== "all") params.set("severity", auditSeverity)
      const data = await fetch(`/api/admin/audit?${params}`, { credentials: "include" }).then(r => r.json())
      setAuditLogs(data.logs ?? [])
    } catch (_) {}
  }, [auditAction, auditSeverity])

  const loadGeoIntelligence = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/geo-intelligence", { credentials: "include" }).then(r => r.json())
      if (data?.overview) setGeoData(data)
    } catch (_) {}
  }, [])

  const loadSupport = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (supportStatusFilter !== "all") params.set("status", supportStatusFilter)
      if (supportPriorityFilter !== "all") params.set("priority", supportPriorityFilter)
      if (supportCategoryFilter !== "all") params.set("category", supportCategoryFilter)
      const [ticketsData, metricsData] = await Promise.all([
        fetch(`/api/admin/support/tickets?${params}`, { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/support/metrics", { credentials: "include" }).then(r => r.json()),
      ])
      setSupportTickets(ticketsData.tickets ?? [])
      setSupportMetrics(metricsData)
    } catch (_) {}
  }, [supportStatusFilter, supportPriorityFilter, supportCategoryFilter])

  const [impLogs, setImpLogs] = useState<ImpersonationLog[]>([])
  const [impLogsLoading, setImpLogsLoading] = useState(false)
  const [impLogsPage, setImpLogsPage] = useState(1)
  const [impLogsTotalPages, setImpLogsTotalPages] = useState(1)
  const [impLogsStats, setImpLogsStats] = useState<ImpersonationStats | null>(null)
  const [expandedImpLog, setExpandedImpLog] = useState<string | null>(null)
  const [impAdminFilter, setImpAdminFilter] = useState("")
  const [impTargetFilter, setImpTargetFilter] = useState("")
  const [impActionFilter, setImpActionFilter] = useState("all")
  const [impDateFrom, setImpDateFrom] = useState("")
  const [impDateTo, setImpDateTo] = useState("")

  const loadImpersonationLogs = useCallback(async (pg = impLogsPage) => {
    setImpLogsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg) })
      if (impActionFilter !== "all") params.set("action", impActionFilter)
      if (impDateFrom) params.set("dateFrom", impDateFrom)
      if (impDateTo) params.set("dateTo", impDateTo)
      const data = await fetch(`/api/admin/impersonation/logs?${params}`, { credentials: "include" }).then(r => r.json())
      setImpLogs(data.logs ?? [])
      setImpLogsTotalPages(data.pagination?.pages ?? 1)
      setImpLogsStats(data.stats ?? null)
    } catch (_) {}
    setImpLogsLoading(false)
  }, [impLogsPage, impActionFilter, impDateFrom, impDateTo])

  const loadTicketDetail = async (ticketId: string) => {
    setLoadingTicket(true)
    try {
      const data = await fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" }).then(r => r.json())
      setSelectedTicket(data)
      setTicketMessages(data.messages ?? [])
    } catch (_) {}
    setLoadingTicket(false)
  }

  const handleSupportReply = async () => {
    if (!supportReply.trim() || !selectedTicket?.ticket) return
    setSendingReply(true)
    try {
      await fetch(`/api/support/tickets/${selectedTicket.ticket.id}/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: supportReply }),
      })
      setSupportReply("")
      await loadTicketDetail(selectedTicket.ticket.id)
      await loadSupport()
    } catch (_) {}
    setSendingReply(false)
  }

  const handleUpdateTicket = async (updates: { status?: string; priority?: string; assignedAdminId?: string | null }) => {
    if (!selectedTicket?.ticket) return
    setUpdatingTicket(true)
    try {
      await fetch(`/api/admin/support/tickets/${selectedTicket.ticket.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      await loadTicketDetail(selectedTicket.ticket.id)
      await loadSupport()
    } catch (_) {}
    setUpdatingTicket(false)
  }

  const loadMessages = useCallback(async () => {
    try {
      const [sendsData, analyticsData, schedulesData] = await Promise.all([
        fetch("/api/admin/message-center", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/notification-analytics", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/notification-schedules", { credentials: "include" }).then(r => r.json()),
      ])
      setMessageSends(sendsData.sends ?? [])
      if (analyticsData?.totalSent !== undefined) setNotifAnalytics(analyticsData)
      setSchedules(schedulesData.schedules ?? [])
    } catch (_) {}
  }, [])

  const loadCrm = useCallback(async () => {
    setCrmLoading(true)
    try {
      const params = new URLSearchParams()
      if (crmLifecycleFilter !== "all") params.set("lifecycle", crmLifecycleFilter)
      if (crmPlanFilter !== "all") params.set("plan", crmPlanFilter)
      if (crmSearch.trim()) params.set("search", crmSearch.trim())
      const [overviewData, usersData] = await Promise.all([
        fetch("/api/admin/crm/overview", { credentials: "include" }).then(r => r.json()),
        fetch(`/api/admin/crm/users?${params}`, { credentials: "include" }).then(r => r.json()),
      ])
      setCrmOverview(overviewData)
      setCrmUsers(usersData.users ?? [])
    } catch (_) {}
    setCrmLoading(false)
  }, [crmLifecycleFilter, crmPlanFilter, crmSearch])

  const loadCrmUserDetail = async (userId: string) => {
    setLoadingCrmDetail(true)
    try {
      const data = await fetch(`/api/admin/crm/users/${userId}`, { credentials: "include" }).then(r => r.json())
      setSelectedCrmUser(data)
      setCrmEditTags(data.crm?.tags ?? [])
      setCrmEditNotes(data.crm?.notes ?? "")
      setCrmEditLifecycle(data.crm?.lifecycleStage ?? "new")
    } catch (_) {}
    setLoadingCrmDetail(false)
  }

  const saveCrmProfile = async () => {
    if (!selectedCrmUser) return
    setCrmSaving(true)
    try {
      await fetch(`/api/admin/crm/users/${selectedCrmUser.user.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycleStage: crmEditLifecycle, tags: crmEditTags, notes: crmEditNotes }),
      })
      await loadCrmUserDetail(selectedCrmUser.user.id)
      await loadCrm()
    } catch (_) {}
    setCrmSaving(false)
  }

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (activeTab === "analytics") loadAnalytics()
    else if (activeTab === "events") loadEvents()
    else if (activeTab === "broadcasts") loadBroadcasts()
    else if (activeTab === "intelligence") loadIntelligence()
    else if (activeTab === "billing") loadBilling()
    else if (activeTab === "billing-intel") loadBillingIntelligence()
    else if (activeTab === "waitlist") loadWaitlist()
    else if (activeTab === "coupons") loadCoupons()
    else if (activeTab === "audit") loadAudit()
    else if (activeTab === "audit-logs") loadAdminAuditLogs()
    else if (activeTab === "geo") loadGeoIntelligence()
    else if (activeTab === "messages") loadMessages()
    else if (activeTab === "support") loadSupport()
    else if (activeTab === "impersonation-logs") loadImpersonationLogs(1)
    else if (activeTab === "crm") loadCrm()
    else if (activeTab === "acquisition") loadAcquisition()
    else if (activeTab === "pipeline") loadPipeline()
  }, [activeTab, loadAnalytics, loadEvents, loadBroadcasts, loadIntelligence, loadBilling, loadBillingIntelligence, loadWaitlist, loadCoupons, loadAudit, loadAdminAuditLogs, loadGeoIntelligence, loadMessages, loadSupport, loadImpersonationLogs, loadCrm, loadAcquisition, loadPipeline])

  // Session Monitor: auto-refresh every 30s while tab is active
  useEffect(() => {
    if (activeTab !== "sessions") return
    loadSessions()
    const id = setInterval(loadSessions, 30000)
    return () => clearInterval(id)
  }, [activeTab, loadSessions])

  useEffect(() => { if (activeTab === "billing") loadBilling() }, [billingRange])
  useEffect(() => { if (activeTab === "waitlist") loadWaitlist() }, [waitlistFilter])
  useEffect(() => { if (activeTab === "audit") loadAudit() }, [auditAction, auditSeverity])

  useEffect(() => {
    if (activeTab !== "events") return
    const es = new EventSource("/api/admin/events/stream", { withCredentials: true })
    sseRef.current = es
    es.addEventListener("open", () => setSseConnected(true))
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.event) setLiveEvents(prev => [data.event as AdminEvent, ...prev].slice(0, 50))
      } catch (_) {}
    })
    es.addEventListener("error", () => setSseConnected(false))
    return () => { es.close(); setSseConnected(false) }
  }, [activeTab])

  useEffect(() => { if (activeTab === "events") loadEvents() }, [eventTypeFilter, activeTab])

  const handleChangePlan = async (userId: string, plan: Plan) => {
    setChangingPlan(userId)
    try {
      await fetch(`/api/admin/users/${userId}/plan`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      await loadData()
      if (activeTab === "billing") await loadBilling()
    } catch (_) {}
    setChangingPlan(null)
  }

  const handleToggleAdmin = async (userId: string, current: boolean) => {
    setTogglingAdmin(userId)
    try {
      await api.admin.updateUser(userId, { isAdmin: !current })
      await loadData()
    } catch (_) {}
    setTogglingAdmin(null)
  }

  const handleDelete = async (userId: string) => {
    setDeletingUser(userId)
    try {
      await api.admin.deleteUser(userId)
      setConfirmDelete(null)
      await loadData()
    } catch (_) {}
    setDeletingUser(null)
  }

  const handleSuspendPlan = async (userId: string, currentStatus: string) => {
    setSuspendingUser(userId)
    try {
      const newStatus = currentStatus === "active" ? "cancelled" : "active"
      await fetch(`/api/admin/users/${userId}/subscription/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      await loadData()
      if (activeTab === "billing") await loadBilling()
    } catch (_) {}
    setSuspendingUser(null)
  }

  const handleSendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return
    setSendingBroadcast(true)
    try {
      await fetch("/api/admin/broadcasts", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...broadcastForm, sendEmail }),
      })
      setBroadcastSent(true)
      setBroadcastForm({ title: "", message: "", type: "info", target: "all" })
      setSendEmail(false)
      setShowEmailPreview(false)
      await loadBroadcasts()
      setTimeout(() => setBroadcastSent(false), 3000)
    } catch (_) {}
    setSendingBroadcast(false)
  }

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await fetch(`/api/admin/broadcasts/${id}`, { method: "DELETE", credentials: "include" })
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    } catch (_) {}
  }

  const handleDeleteWaitlist = async (id: string) => {
    setDeletingWaitlist(id)
    try {
      await fetch(`/api/admin/waitlist/${id}`, { method: "DELETE", credentials: "include" })
      setWaitlist(prev => prev.filter(w => w.id !== id))
    } catch (_) {}
    setDeletingWaitlist(null)
  }

  const handleCreateCoupon = async () => {
    setCouponError(null)
    if (!couponForm.code.trim() || !couponForm.value) { setCouponError("Code and value are required"); return }
    setCreatingCoupon(true)
    try {
      const body: Record<string, unknown> = {
        code: couponForm.code.toUpperCase().trim(),
        type: couponForm.type,
        value: parseFloat(couponForm.value),
      }
      if (couponForm.maxUses) body.maxUses = parseInt(couponForm.maxUses)
      if (couponForm.expiresAt) body.expiresAt = couponForm.expiresAt
      if (couponForm.description) body.description = couponForm.description

      const res = await fetch("/api/admin/coupons", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setCouponError(data.error ?? "Failed to create coupon"); return }
      setCouponSuccess(true)
      setCouponForm({ code: "", type: "percentage", value: "", maxUses: "", expiresAt: "", description: "" })
      setShowCouponForm(false)
      await loadCoupons()
      setTimeout(() => setCouponSuccess(false), 3000)
    } catch (_) { setCouponError("Failed to create coupon") }
    setCreatingCoupon(false)
  }

  const handleToggleCoupon = async (id: string, disabled: boolean) => {
    try {
      await fetch(`/api/admin/coupons/${id}/${disabled ? "enable" : "disable"}`, {
        method: "PATCH", credentials: "include",
      })
      await loadCoupons()
    } catch (_) {}
  }

  const handleDeleteCoupon = async (id: string) => {
    try {
      await fetch(`/api/admin/coupons/${id}`, { method: "DELETE", credentials: "include" })
      setCoupons(prev => prev.filter(c => c.id !== id))
    } catch (_) {}
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredSessions = (sessionData?.sessions ?? []).filter(s => {
    const q = sessionSearch.toLowerCase()
    const matchSearch = !sessionSearch ||
      (s.userEmail ?? "").toLowerCase().includes(q) ||
      (s.userName ?? "").toLowerCase().includes(q)
    const matchStatus = sessionStatusFilter === "all" ||
      (sessionStatusFilter === "online" && s.isOnline) ||
      (sessionStatusFilter === "offline" && !s.isOnline)
    const matchPlan = sessionPlanFilter === "all" || s.plan === sessionPlanFilter
    return matchSearch && matchStatus && matchPlan
  })

  const filteredAudit = auditLogs.filter(l =>
    !auditSearch ||
    l.action.includes(auditSearch.toLowerCase()) ||
    (l.userEmail ?? "").toLowerCase().includes(auditSearch.toLowerCase()) ||
    (l.resource ?? "").includes(auditSearch.toLowerCase())
  )

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "users",              label: "Users",          icon: Users },
    { id: "stats",              label: "Stats",          icon: BarChart3 },
    { id: "billing",            label: "Billing",        icon: DollarSign },
    { id: "billing-intel",      label: "Billing Intel",  icon: CreditCard },
    { id: "events",             label: "Events",         icon: Radio },
    { id: "analytics",          label: "Analytics",      icon: BarChart3 },
    { id: "intelligence",       label: "Intelligence",   icon: Bot },
    { id: "messages",           label: "Messages",       icon: Send },
    { id: "broadcasts",         label: "Broadcast",      icon: Megaphone },
    { id: "waitlist",           label: "Waitlist",       icon: UserCheck },
    { id: "coupons",            label: "Coupons",        icon: Tag },
    { id: "sessions",           label: "Sessions",       icon: Monitor },
    { id: "audit-logs",         label: "Admin Audit",    icon: ClipboardList },
    { id: "geo",                label: "Geo Intel",      icon: Globe },
    { id: "support",            label: "Support",        icon: FileText },
    { id: "impersonation-logs", label: "Impersonation",  icon: Eye },
    { id: "crm",                label: "CRM Intel",      icon: Target },
    { id: "acquisition",        label: "Acquisition",    icon: Funnel },
    { id: "feature-flags",      label: "Feature Flags",  icon: Flag },
    { id: "system-health",      label: "System Health",  icon: Activity },
    { id: "ai-models",          label: "AI Models",      icon: Cpu },
    { id: "security",           label: "Security",       icon: Shield },
    { id: "incidents",          label: "Incidents",      icon: AlertTriangle },
    { id: "backups",            label: "Backups",        icon: Database },
    { id: "pipeline",           label: "Pipeline",       icon: Layers },
  ]

  if (!user?.isAdmin) return null

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Shield className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Admin Panel</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <div
              ref={tabBarRef}
              onWheel={e => { e.preventDefault(); if (tabBarRef.current) tabBarRef.current.scrollLeft += e.deltaY * 0.8 }}
              className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1 overflow-x-auto flex-1 min-w-0"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === id ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => {
              loadData()
              if (activeTab === "analytics") loadAnalytics()
              if (activeTab === "events") loadEvents()
              if (activeTab === "broadcasts") loadBroadcasts()
              if (activeTab === "intelligence") loadIntelligence()
              if (activeTab === "billing") loadBilling()
              if (activeTab === "waitlist") loadWaitlist()
              if (activeTab === "coupons") loadCoupons()
              if (activeTab === "audit") loadAudit()
              if (activeTab === "sessions") loadSessions()
              if (activeTab === "geo") loadGeoIntelligence()
              if (activeTab === "support") loadSupport()
              if (activeTab === "crm") loadCrm()
            }} disabled={loading}
              className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Stats Tab ─────────────────────────────────────────────────── */}
          {activeTab === "stats" && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, icon: Users, color: "#6366F1" },
                  { label: "Admin Users", value: stats.admins, icon: Shield, color: "#EF4444" },
                  { label: "Total Generations", value: stats.totalGenerations, icon: BarChart3, color: "#D4AF37" },
                  { label: "Pro+ Users", value: (stats.planCounts.pro ?? 0) + (stats.planCounts.startup ?? 0) + (stats.planCounts.enterprise ?? 0), icon: Crown, color: "#8B5CF6" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <StatCard key={label} label={label} value={value} icon={Icon} color={color} />
                ))}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-4">Plan Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(["free", "pro", "startup", "enterprise"] as Plan[]).map(plan => {
                    const meta = PLAN_META[plan]
                    const Icon = meta.icon
                    const cnt = stats.planCounts[plan] ?? 0
                    const pct = stats.totalUsers > 0 ? Math.round((cnt / stats.totalUsers) * 100) : 0
                    return (
                      <div key={plan} className="rounded-xl border border-white/8 bg-white/2 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}15` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{meta.label}</span>
                        </div>
                        <p className="text-xl font-black text-foreground">{cnt}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}% of users</p>
                        <MiniBar pct={pct} color={meta.color} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Billing Tab ────────────────────────────────────────────────── */}
          {activeTab === "billing" && (
            <div className="space-y-5">
              {!billing ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <>
                  {/* MRR Hero */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="col-span-2 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-[#D4AF37]" />
                        <span className="text-xs font-black text-[#D4AF37] uppercase tracking-widest">Monthly Recurring Revenue</span>
                      </div>
                      <p className="text-4xl font-black text-foreground">${(billing.mrr ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">ARR: ${(billing.arr ?? 0).toLocaleString()} / year</p>
                    </motion.div>
                    <StatCard label="Active Subscriptions" value={billing.activeSubs} icon={CreditCard} color="#6366F1" />
                    <StatCard label="Conversion Rate" value={`${billing.conversionRate}%`} icon={TrendingUp} color="#10B981" sub="free → paid" />
                  </div>

                  {/* Plan breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(["free", "pro", "startup", "enterprise"] as Plan[]).map(plan => {
                      const meta = PLAN_META[plan]
                      const Icon = meta.icon
                      const cnt = (billing.planCounts ?? {})[plan] ?? 0
                      const pct = billing.activeSubs > 0 ? Math.round((cnt / billing.activeSubs) * 100) : 0
                      const MRR_MAP: Record<string, number> = { free: 0, pro: 29, startup: 99, enterprise: 299 }
                      return (
                        <motion.div key={plan} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-white/8 bg-white/2 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}15` }}>
                              <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                            </div>
                            <span className="text-xs font-bold text-foreground capitalize">{plan}</span>
                          </div>
                          <p className="text-2xl font-black text-foreground">{cnt}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{pct}% · ${(cnt * MRR_MAP[plan]).toLocaleString()}/mo</p>
                          <MiniBar pct={pct} color={meta.color} />
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-3 gap-4">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-xl bg-emerald-500/10"><ArrowUp className="h-3.5 w-3.5 text-emerald-400" /></div>
                        <span className="text-xs font-bold text-foreground">Upgrades (30d)</span>
                      </div>
                      <p className="text-2xl font-black text-emerald-400">{billing.upgradeRate30d}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Plan upgrades this month</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-xl bg-red-500/10"><ArrowDown className="h-3.5 w-3.5 text-red-400" /></div>
                        <span className="text-xs font-bold text-foreground">Downgrades (30d)</span>
                      </div>
                      <p className="text-2xl font-black text-red-400">{billing.downgradeRate30d}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Plan downgrades this month</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-xl bg-primary/10"><Users className="h-3.5 w-3.5 text-primary" /></div>
                        <span className="text-xs font-bold text-foreground">Free Users</span>
                      </div>
                      <p className="text-2xl font-black text-foreground">{billing.freeUsers}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Not converting</p>
                    </motion.div>
                  </div>

                  {/* Growth chart */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-foreground">User Growth</h3>
                      <div className="flex gap-1">
                        {(["7d", "30d", "90d", "all"] as const).map(r => (
                          <button key={r} onClick={() => setBillingRange(r)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${billingRange === r ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {billingCharts?.dailySignups && billingCharts.dailySignups.length > 0 ? (
                      <div className="space-y-1.5">
                        {(() => {
                          const max = Math.max(...billingCharts.dailySignups.map(d => d.count), 1)
                          return billingCharts.dailySignups.slice(-20).map((d, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground/60 w-20 shrink-0 font-mono">{d.date}</span>
                              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(d.count / max) * 100}%` }}
                                  transition={{ delay: i * 0.02, duration: 0.6 }}
                                  className="h-full rounded-full bg-primary/70" />
                              </div>
                              <span className="text-[10px] font-black text-foreground w-6 text-right">{d.count}</span>
                            </div>
                          ))
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No signup data for this range</p>
                    )}
                  </div>

                  {/* Plan Management — user list with billing controls */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-4">Plan Management</h3>
                    <div className="space-y-2">
                      {users.slice(0, 20).map((u) => {
                        const plan = (u.subscription?.plan ?? "free") as Plan
                        const status = u.subscription?.status ?? "active"
                        const meta = PLAN_META[plan]
                        const suspended = status !== "active"
                        return (
                          <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/6 bg-white/2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <PlanBadge plan={plan} />
                            {suspended && (
                              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">Suspended</span>
                            )}
                            {/* Plan selector */}
                            <select value={plan} onChange={e => handleChangePlan(u.id, e.target.value as Plan)}
                              disabled={changingPlan === u.id}
                              className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-foreground px-2 py-1 outline-none cursor-pointer">
                              {(["free", "pro", "startup", "enterprise"] as Plan[]).map(p => (
                                <option key={p} value={p} className="bg-[#1a1a1a]">{PLAN_META[p].label}</option>
                              ))}
                            </select>
                            {/* Suspend/Reactivate */}
                            <button onClick={() => handleSuspendPlan(u.id, status)}
                              disabled={suspendingUser === u.id}
                              className={`p-1.5 rounded-lg transition-colors ${suspended ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/5"}`}
                              title={suspended ? "Reactivate" : "Suspend"}>
                              {suspendingUser === u.id
                                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                : suspended ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Billing Intelligence Tab ───────────────────────────────────── */}
          {activeTab === "billing-intel" && (() => {
            const PLAN_COLOR: Record<string, string> = { free: "#6B7280", pro: "#6366F1", startup: "#D4AF37", enterprise: "#10B981" }
            const SECTION_NAV: { id: typeof biSection; label: string; icon: React.ElementType }[] = [
              { id: "overview",      label: "Overview",       icon: BarChart3 },
              { id: "revenue",       label: "Revenue",        icon: DollarSign },
              { id: "distribution",  label: "Plan Dist.",     icon: Layers },
              { id: "funnel",        label: "Upgrade Funnel", icon: Funnel },
              { id: "usage",         label: "Usage Econ.",    icon: Cpu },
              { id: "power",         label: "Power Users",    icon: Flame },
              { id: "readiness",     label: "Readiness",      icon: CheckCircle2 },
            ]
            return (
              <div className="space-y-5">
                {/* Section nav */}
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_NAV.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setBiSection(id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${biSection === id ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30" : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"}`}>
                      <Icon className="h-3 w-3" />{label}
                    </button>
                  ))}
                </div>

                {biIntelLoading && (
                  <div className="flex items-center justify-center py-24">
                    <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                  </div>
                )}

                {!biIntelLoading && (
                  <>
                    {/* ── 1. Overview ─────────────────────────────────── */}
                    {biSection === "overview" && biRevenue && biFunnel && biReadiness && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="col-span-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-[#D4AF37]" />
                              <span className="text-xs font-black text-[#D4AF37] uppercase tracking-widest">Simulated MRR</span>
                            </div>
                            <p className="text-4xl font-black text-foreground">${biRevenue.mrr.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground mt-1">ARR: ${biRevenue.arr.toLocaleString()} / year</p>
                          </motion.div>
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                            className="rounded-2xl border border-white/8 bg-white/2 p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Users</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{biReadiness.totalUsers}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{biReadiness.paidUsers} paid</p>
                          </motion.div>
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="rounded-2xl border border-white/8 bg-white/2 p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Conversion</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">
                              {biReadiness.totalUsers > 0 ? Math.round((biReadiness.paidUsers / biReadiness.totalUsers) * 1000) / 10 : 0}%
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">free → paid</p>
                          </motion.div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {(["free", "pro", "startup", "enterprise"] as const).map((plan, i) => {
                            const row = biRevenue.breakdown.find(r => r.plan === plan)
                            const color = PLAN_COLOR[plan]
                            return (
                              <motion.div key={plan} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl border border-white/8 bg-white/2 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
                                    <Users className="h-3 w-3" style={{ color }} />
                                  </div>
                                  <span className="text-xs font-bold text-foreground capitalize">{plan}</span>
                                </div>
                                <p className="text-2xl font-black text-foreground">{row?.users ?? 0}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">${(row?.totalRevenue ?? 0).toLocaleString()}/mo</p>
                                <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${row?.share ?? 0}%` }}
                                    transition={{ delay: 0.3 + i * 0.05, duration: 0.7 }}
                                    className="h-full rounded-full" style={{ background: color }} />
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {biFunnel.conversions.map((c, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                              className="rounded-2xl border border-white/8 bg-white/2 p-5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="p-1 rounded-lg bg-emerald-500/10"><ArrowUp className="h-3 w-3 text-emerald-400" /></div>
                                <span className="text-xs font-bold text-foreground">{c.from} → {c.to}</span>
                              </div>
                              <p className="text-2xl font-black text-emerald-400">{c.count}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">conversions · {c.rate}% rate</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── 2. Revenue ───────────────────────────────────── */}
                    {biSection === "revenue" && biRevenue && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <DollarSign className="h-4 w-4 text-[#D4AF37]" />
                            <h3 className="text-sm font-black text-[#D4AF37] uppercase tracking-widest">Revenue Breakdown</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Monthly MRR</p>
                              <p className="text-3xl font-black text-foreground">${biRevenue.mrr.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Annual ARR</p>
                              <p className="text-3xl font-black text-foreground">${biRevenue.arr.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {biRevenue.breakdown.filter(r => r.plan !== "free").map((row, i) => {
                              const color = PLAN_COLOR[row.plan]
                              const maxRev = Math.max(...biRevenue.breakdown.map(r => r.totalRevenue), 1)
                              return (
                                <motion.div key={row.plan} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.08 }}
                                  className="flex items-center gap-4 p-4 rounded-xl border border-white/6 bg-white/2">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                  <div className="w-20 shrink-0">
                                    <p className="text-xs font-black text-foreground capitalize">{row.plan}</p>
                                    <p className="text-[10px] text-muted-foreground">${row.revenuePerUser}/user/mo</p>
                                  </div>
                                  <div className="flex-1">
                                    <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${(row.totalRevenue / maxRev) * 100}%` }}
                                        transition={{ delay: 0.3 + i * 0.08, duration: 0.7 }}
                                        className="h-full rounded-full" style={{ background: color }} />
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 w-28">
                                    <p className="text-sm font-black text-foreground">${row.totalRevenue.toLocaleString()}/mo</p>
                                    <p className="text-[10px] text-muted-foreground">{row.users} users · {row.share}% share</p>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 3. Plan Distribution ─────────────────────────── */}
                    {biSection === "distribution" && biRevenue && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                          <h3 className="text-sm font-black text-foreground mb-5">Plan Distribution</h3>
                          <div className="space-y-4">
                            {biRevenue.breakdown.map((row, i) => {
                              const color = PLAN_COLOR[row.plan]
                              const totalUsers = biRevenue.breakdown.reduce((s, r) => s + r.users, 0)
                              const pct = totalUsers > 0 ? Math.round((row.users / totalUsers) * 1000) / 10 : 0
                              return (
                                <motion.div key={row.plan} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.06 }}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                      <span className="text-xs font-bold text-foreground capitalize">{row.plan}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-black text-foreground">{row.users}</span>
                                      <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                                    </div>
                                  </div>
                                  <div className="h-7 bg-white/5 rounded-xl overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                      transition={{ delay: 0.2 + i * 0.06, duration: 0.8 }}
                                      className="h-full rounded-xl flex items-center pl-3" style={{ background: `${color}60` }}>
                                      {pct > 10 && <span className="text-[10px] font-black" style={{ color }}>{pct}%</span>}
                                    </motion.div>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                          <div className="mt-6 pt-5 border-t border-white/6 flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Total users</span>
                            <span className="text-sm font-black text-foreground">{biRevenue.breakdown.reduce((s, r) => s + r.users, 0)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 4. Upgrade Funnel ───────────────────────────── */}
                    {biSection === "funnel" && biFunnel && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                          <h3 className="text-sm font-black text-foreground mb-5">Upgrade Funnel</h3>
                          <div className="flex items-end gap-2 mb-8">
                            {biFunnel.stages.map((s, i) => {
                              const colors = ["#6B7280", "#6366F1", "#D4AF37", "#10B981"]
                              const maxCnt = Math.max(...biFunnel.stages.map(st => st.count), 1)
                              const heightPct = Math.max((s.count / maxCnt) * 100, 4)
                              return (
                                <div key={s.stage} className="flex-1 flex flex-col items-center gap-2">
                                  <span className="text-xs font-black text-foreground">{s.count}</span>
                                  <motion.div initial={{ height: 0 }} animate={{ height: `${heightPct * 1.2}px` }}
                                    transition={{ delay: i * 0.1, duration: 0.6 }}
                                    className="w-full rounded-t-xl" style={{ background: `${colors[i]}40`, borderTop: `2px solid ${colors[i]}` }} />
                                  <span className="text-[10px] font-bold text-muted-foreground">{s.stage}</span>
                                  <span className="text-[10px] text-muted-foreground/60">{s.pct}%</span>
                                </div>
                              )
                            })}
                          </div>
                          <div className="space-y-3">
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Conversion Events (All Time)</p>
                            {biFunnel.conversions.map((c, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className="flex items-center gap-4 p-4 rounded-xl border border-white/6 bg-white/2">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="w-2 h-2 rounded-full bg-white/30" />
                                  <span className="text-xs font-bold text-foreground">{c.from}</span>
                                  <ArrowUp className="h-3 w-3 text-emerald-400" />
                                  <span className="text-xs font-bold text-foreground">{c.to}</span>
                                </div>
                                <div className="flex items-center gap-6 text-right">
                                  <div>
                                    <p className="text-sm font-black text-foreground">{c.count}</p>
                                    <p className="text-[10px] text-muted-foreground">conversions</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-emerald-400">{c.rate}%</p>
                                    <p className="text-[10px] text-muted-foreground">rate</p>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 5. Usage Economics ──────────────────────────── */}
                    {biSection === "usage" && biUsage && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                          <h3 className="text-sm font-black text-foreground mb-5">Usage Economics by Plan</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-white/6">
                                  {["Plan", "Users", "BI Gen", "Website Gen", "Chatbot Gen", "Automation", "Marcus", "Avg Gen/User"].map(h => (
                                    <th key={h} className="text-left pb-3 pr-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(["free", "pro", "startup", "enterprise"] as const).map((plan, i) => {
                                  const row = biUsage.economics.find(r => r.plan === plan)
                                  const color = PLAN_COLOR[plan]
                                  return (
                                    <motion.tr key={plan} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                      transition={{ delay: i * 0.06 }}
                                      className="border-b border-white/4">
                                      <td className="py-3 pr-4">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                          <span className="font-bold text-foreground capitalize">{plan}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 pr-4 font-bold text-foreground">{row?.userCount ?? 0}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{row?.totalBiGenerations ?? 0}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{row?.totalWebsiteGenerations ?? 0}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{row?.totalChatbotGenerations ?? 0}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{row?.totalAutomationGenerations ?? 0}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{row?.totalMarcusMessages ?? 0}</td>
                                      <td className="py-3 font-black" style={{ color }}>{row?.avgGenerationsPerUser ?? 0}</td>
                                    </motion.tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {biUsage.economics.filter(r => r.plan !== "free").map((row, i) => {
                            const color = PLAN_COLOR[row.plan]
                            const metrics = [
                              { label: "BI Gen", value: row.totalBiGenerations },
                              { label: "Website", value: row.totalWebsiteGenerations },
                              { label: "Chatbot", value: row.totalChatbotGenerations },
                              { label: "Automation", value: row.totalAutomationGenerations },
                              { label: "Marcus", value: row.totalMarcusMessages },
                            ]
                            const maxVal = Math.max(...metrics.map(m => m.value), 1)
                            return (
                              <motion.div key={row.plan} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="rounded-2xl border border-white/8 bg-white/2 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                  <span className="text-xs font-black text-foreground capitalize">{row.plan}</span>
                                </div>
                                {metrics.map(m => (
                                  <div key={m.label} className="mb-2">
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-muted-foreground">{m.label}</span>
                                      <span className="font-bold text-foreground">{m.value}</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${(m.value / maxVal) * 100}%` }}
                                        transition={{ delay: 0.4, duration: 0.6 }}
                                        className="h-full rounded-full" style={{ background: color }} />
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── 6. Power Users ──────────────────────────────── */}
                    {biSection === "power" && biPowerUsers && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                          <div className="flex items-center justify-between mb-5">
                            <div>
                              <h3 className="text-sm font-black text-foreground">Top Revenue Candidates</h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by upgrade likelihood score</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                              <Flame className="h-3 w-3 text-[#D4AF37]" />
                              <span className="text-[10px] font-black text-[#D4AF37]">{biPowerUsers.users.filter(u => u.upgradeLikelihood >= 70).length} hot leads</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {biPowerUsers.users.map((u, i) => {
                              const planColor = PLAN_COLOR[u.plan]
                              const likelihood = u.upgradeLikelihood
                              const heatColor = likelihood >= 80 ? "#EF4444" : likelihood >= 60 ? "#F59E0B" : likelihood >= 40 ? "#6366F1" : "#6B7280"
                              return (
                                <motion.div key={u.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.02 }}
                                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 transition-colors">
                                  <div className="text-[10px] font-black text-muted-foreground/50 w-5 text-center">{i + 1}</div>
                                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                    style={{ background: `${planColor}20`, color: planColor }}>
                                    {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{u.name ?? "—"}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                                  </div>
                                  <div className="hidden md:flex items-center gap-4 text-right shrink-0">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Plan</p>
                                      <span className="text-[10px] font-black capitalize" style={{ color: planColor }}>{u.plan}</span>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Gens</p>
                                      <p className="text-[10px] font-black text-foreground">{u.totalGenerations}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Projects</p>
                                      <p className="text-[10px] font-black text-foreground">{u.projectCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Usage</p>
                                      <p className="text-[10px] font-black text-foreground">{u.aiUsedPct}%</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0 w-16">
                                    <div className="flex items-center gap-1">
                                      <Target className="h-2.5 w-2.5" style={{ color: heatColor }} />
                                      <span className="text-xs font-black" style={{ color: heatColor }}>{likelihood}</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${likelihood}%` }}
                                        transition={{ delay: 0.1 + i * 0.015, duration: 0.5 }}
                                        className="h-full rounded-full" style={{ background: heatColor }} />
                                    </div>
                                    <p className="text-[8px] text-muted-foreground/50">likelihood</p>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 7. Billing Readiness ────────────────────────── */}
                    {biSection === "readiness" && biReadiness && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-sm font-black text-foreground">Billing Readiness</h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Infrastructure preparation for monetization</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-black text-foreground">{biReadiness.readinessPct}%</p>
                              <p className="text-[10px] text-muted-foreground">{biReadiness.readyCount}/{biReadiness.totalChecks} checks</p>
                            </div>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${biReadiness.readinessPct}%` }}
                              transition={{ duration: 0.8 }}
                              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-emerald-400" />
                          </div>
                          <div className="space-y-3">
                            {biReadiness.checks.map((check, i) => {
                              const Icon = check.status === "ready" ? CheckCircle2 : check.status === "pending" ? Circle : AlertCircle
                              const color = check.status === "ready" ? "#10B981" : check.status === "pending" ? "#F59E0B" : "#6B7280"
                              return (
                                <motion.div key={check.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.06 }}
                                  className="flex items-start gap-3 p-4 rounded-xl border border-white/6 bg-white/2">
                                  <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color }} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-foreground">{check.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{check.detail}</p>
                                  </div>
                                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                    style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
                                    {check.status === "not_started" ? "Pending" : check.status}
                                  </span>
                                </motion.div>
                              )
                            })}
                          </div>
                          <div className="mt-6 pt-5 border-t border-white/6 grid grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Database className="h-3.5 w-3.5 text-[#D4AF37]" />
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Schema Tables</span>
                              </div>
                              <p className="text-lg font-black text-foreground">3</p>
                              <p className="text-[10px] text-muted-foreground">billing_* tables ready</p>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Users className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Paid Users</span>
                              </div>
                              <p className="text-lg font-black text-foreground">{biReadiness.paidUsers}</p>
                              <p className="text-[10px] text-muted-foreground">of {biReadiness.totalUsers} total</p>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sim. MRR</span>
                              </div>
                              <p className="text-lg font-black text-foreground">${biReadiness.mrr.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">when Stripe connected</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* ── Users Tab ─────────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search users by email or name..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((u, i) => {
                    const plan = (u.subscription?.plan ?? "free") as Plan
                    const meta = PLAN_META[plan] ?? PLAN_META["free"]
                    const isExpanded = expandedUser === u.id
                    return (
                      <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            {(u.name ?? u.email)[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">{u.name}</span>
                              {u.isAdmin && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-400 uppercase">
                                  <Shield className="h-2 w-2" />Admin
                                </span>
                              )}
                              {u.id === user?.id && <span className="text-[9px] text-muted-foreground/50">(you)</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                              {u.country && (
                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />{u.city ? `${u.city}, ` : ""}{u.country}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="hidden md:flex items-center gap-3">
                            <PlanBadge plan={plan} />
                            {u.subscription && (
                              <span className="text-[10px] text-muted-foreground">
                                {u.subscription.aiGenerationsUsed}/{u.subscription.aiGenerationsLimit === 9999 ? "∞" : u.subscription.aiGenerationsLimit} gen
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <button onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                              <div className="px-5 py-4 space-y-4">

                                {/* Billing Profile */}
                                {u.subscription && (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Plan</p>
                                      <PlanBadge plan={plan} />
                                    </div>
                                    <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Generations</p>
                                      <p className="text-sm font-black text-foreground">{u.subscription.aiGenerationsUsed} <span className="text-muted-foreground font-normal">/ {u.subscription.aiGenerationsLimit === 9999 ? "∞" : u.subscription.aiGenerationsLimit}</span></p>
                                      <div className="mt-1.5">
                                        <MiniBar pct={u.subscription.aiGenerationsLimit > 0 ? (u.subscription.aiGenerationsUsed / u.subscription.aiGenerationsLimit) * 100 : 0} color="#D4AF37" />
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                                      <span className={`text-xs font-bold ${u.subscription.status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                                        {u.subscription.status}
                                      </span>
                                    </div>
                                    <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Period End</p>
                                      <p className="text-xs font-bold text-foreground">{new Date(u.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">Change Plan:</p>
                                  {(["free", "pro", "startup", "enterprise"] as Plan[]).map(p => {
                                    const pm = PLAN_META[p]
                                    return (
                                      <button key={p} onClick={() => handleChangePlan(u.id, p)}
                                        disabled={changingPlan === u.id || plan === p}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${plan === p ? "opacity-50 cursor-default" : "hover:opacity-80"}`}
                                        style={{ background: `${pm.color}15`, color: pm.color, borderColor: `${pm.color}30` }}>
                                        {changingPlan === u.id ? "..." : pm.label}
                                      </button>
                                    )
                                  })}
                                  <div className="ml-auto flex gap-2">
                                    {/* Suspend/Reactivate */}
                                    <button onClick={() => handleSuspendPlan(u.id, u.subscription?.status ?? "active")}
                                      disabled={suspendingUser === u.id}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${u.subscription?.status !== "active" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                                      {suspendingUser === u.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : u.subscription?.status !== "active" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                      {u.subscription?.status !== "active" ? "Reactivate" : "Suspend"}
                                    </button>
                                    <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} disabled={togglingAdmin === u.id || u.id === user?.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-40">
                                      <Shield className="h-3 w-3" />
                                      {togglingAdmin === u.id ? "..." : u.isAdmin ? "Remove Admin" : "Make Admin"}
                                    </button>
                                    {confirmDelete === u.id ? (
                                      <div className="flex gap-1">
                                        <button onClick={() => handleDelete(u.id)} disabled={deletingUser === u.id}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-all">
                                          {deletingUser === u.id ? "Deleting..." : "Confirm Delete"}
                                        </button>
                                        <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setConfirmDelete(u.id)} disabled={u.id === user?.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/20 transition-all disabled:opacity-30">
                                        <Trash2 className="h-3 w-3" />Delete
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Impersonation */}
                                {u.id !== user?.id && (
                                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                    <Eye className="h-3 w-3 text-amber-400/70 shrink-0" />
                                    <p className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest shrink-0">Impersonate</p>
                                    <input
                                      type="text"
                                      value={impersonationReason[u.id] ?? ""}
                                      onChange={e => setImpersonationReason(prev => ({ ...prev, [u.id]: e.target.value }))}
                                      placeholder="Reason (optional)"
                                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-amber-500/30 transition-colors"
                                    />
                                    <button
                                      onClick={() => handleImpersonate(u.id)}
                                      disabled={impersonatingUserId === u.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40 shrink-0">
                                      {impersonatingUserId === u.id
                                        ? <><RefreshCw className="h-3 w-3 animate-spin" /> Starting…</>
                                        : <><Eye className="h-3 w-3" /> Impersonate User</>}
                                    </button>
                                    {impersonationError && impersonatingUserId === null && (
                                      <span className="text-[10px] text-red-400">{impersonationError}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Events Tab ────────────────────────────────────────────────── */}
          {activeTab === "events" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full border ${sseConnected ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground border-white/8 bg-white/3"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
                  {sseConnected ? "Live" : "Disconnected"}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {["all", ...Object.keys(EVENT_TYPE_META)].map(t => (
                    <button key={t} onClick={() => setEventTypeFilter(t)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all capitalize ${eventTypeFilter === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {t === "all" ? "All" : (EVENT_TYPE_META[t]?.label ?? t)}
                    </button>
                  ))}
                </div>
              </div>

              {liveEvents.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</p>
                  {liveEvents.slice(0, 5).map((e, i) => (
                    <motion.div key={`live-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5">
                      <EventTypeBadge type={e.type} />
                      <span className="text-xs text-muted-foreground truncate flex-1">{e.userEmail ?? "anonymous"}</span>
                      <span className="text-[10px] text-muted-foreground/50">{timeAgo(e.createdAt)}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {events.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/6 bg-white/2">
                    <EventTypeBadge type={e.type} />
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{e.userName ?? e.userEmail ?? "anonymous"}</span>
                    {(e.city || e.country) && (
                      <span className="text-[10px] text-muted-foreground/60 hidden md:flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />{[e.city, e.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeAgo(e.createdAt)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Analytics Tab ─────────────────────────────────────────────── */}
          {activeTab === "analytics" && analytics && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: analytics.overview.totalUsers, icon: Users, color: "#6366F1" },
                  { label: "Active (24h)", value: analytics.overview.activeUsers24h, icon: Activity, color: "#10B981" },
                  { label: "Active (30d)", value: analytics.overview.activeUsers30d, icon: Globe, color: "#D4AF37" },
                  { label: "Marcus Messages", value: analytics.overview.totalMarcusMessages, icon: Bot, color: "#8B5CF6" },
                ].map(c => <StatCard key={c.label} {...c} />)}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-4">Daily Signups (30d)</h3>
                  {analytics.dailySignups.length > 0 ? (
                    <div className="space-y-1.5">
                      {(() => {
                        const max = Math.max(...analytics.dailySignups.map(d => d.signups), 1)
                        return analytics.dailySignups.slice(-14).map((d, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground/60 w-16 shrink-0 font-mono">{d.date.slice(5)}</span>
                            <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(d.signups / max) * 100}%` }}
                                transition={{ delay: i * 0.03 }} className="h-full rounded-full bg-primary/70" />
                            </div>
                            <span className="text-[10px] font-black text-foreground w-4 text-right">{d.signups}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No data</p>}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-4">Conversion Funnel</h3>
                  <div className="space-y-3">
                    {analytics.funnel.map((f, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{f.stage}</span>
                          <span className="text-xs font-bold text-foreground">{f.count} <span className="text-muted-foreground font-normal">({f.pct}%)</span></span>
                        </div>
                        <MiniBar pct={f.pct} color="#D4AF37" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-4">Top Countries</h3>
                  <div className="space-y-2">
                    {analytics.geo.slice(0, 8).map((g, i) => {
                      const max = analytics.geo[0]?.users ?? 1
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-24 truncate">{g.country ?? "Unknown"}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(g.users / max) * 100}%` }}
                              transition={{ delay: i * 0.04 }} className="h-full rounded-full bg-primary/60" />
                          </div>
                          <span className="text-xs font-bold text-foreground">{g.users}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-4">Top Users by Activity</h3>
                  <div className="space-y-2">
                    {analytics.topUsers.slice(0, 8).map((u, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-full bg-white/8 flex items-center justify-center text-[9px] font-black text-muted-foreground">{i + 1}</span>
                        <span className="text-xs text-muted-foreground truncate flex-1">{u.email ?? "—"}</span>
                        <span className="text-xs font-black text-foreground">{u.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Intelligence Tab ───────────────────────────────────────────── */}
          {activeTab === "intelligence" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search..." value={intelligenceSearch} onChange={e => setIntelligenceSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(["all", "active", "power", "paid", "new", "inactive"] as const).map(f => (
                    <button key={f} onClick={() => setIntelligenceFilter(f)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all capitalize ${intelligenceFilter === f ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {intelligence ? (
                <div className="space-y-2">
                  {intelligence
                    .filter(u => {
                      if (intelligenceSearch) {
                        const q = intelligenceSearch.toLowerCase()
                        return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
                      }
                      if (intelligenceFilter === "active") return u.activityScore > 5
                      if (intelligenceFilter === "power") return u.activityScore > 20
                      if (intelligenceFilter === "paid") return u.plan !== "free"
                      if (intelligenceFilter === "new") return Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000
                      if (intelligenceFilter === "inactive") return u.activityScore === 0
                      return true
                    })
                    .sort((a, b) => {
                      if (intelligenceSort === "createdAt") {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      }
                      return (b[intelligenceSort] as number) - (a[intelligenceSort] as number)
                    })
                    .slice(0, 50)
                    .map((u, i) => (
                      <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                        className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-white/8 bg-white/2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground truncate">{u.name}</span>
                            <PlanBadge plan={u.plan as Plan} />
                          </div>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span title="BI"><span className="text-foreground font-bold">{u.biGenerations}</span> BI</span>
                          <span title="Website"><span className="text-foreground font-bold">{u.websiteGenerations}</span> Web</span>
                          <span title="Marcus"><span className="text-foreground font-bold">{u.marcusMessages}</span> MRK</span>
                          <span title="Projects"><span className="text-foreground font-bold">{u.projectCount}</span> Proj</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black" style={{ color: u.activityScore > 20 ? "#D4AF37" : u.activityScore > 5 ? "#10B981" : "#6B7280" }}>{u.activityScore}</p>
                          <p className="text-[9px] text-muted-foreground">score</p>
                        </div>
                      </motion.div>
                    ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* ── Messages Tab ───────────────────────────────────────────────── */}
          {activeTab === "messages" && (
            <div className="space-y-5">

              {/* ── Analytics Row ───────────────────────────────────────────── */}
              {notifAnalytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Sent" value={notifAnalytics.totalSent.toLocaleString()} icon={Send} color="#6366F1" />
                  <StatCard label="Total Read" value={notifAnalytics.totalRead.toLocaleString()} icon={Eye} color="#10B981" />
                  <StatCard label="Unread" value={notifAnalytics.unreadCount.toLocaleString()} icon={Mail} color="#F59E0B" />
                  <StatCard label="Read Rate" value={`${notifAnalytics.readRate}%`} icon={Activity} color="#D4AF37" />
                </div>
              )}

              {/* ── Top Notifications ─────────────────────────────────────── */}
              {notifAnalytics && notifAnalytics.topNotifications.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-xs font-black text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Top Notifications by Reads
                  </h3>
                  <div className="space-y-2">
                    {notifAnalytics.topNotifications.map((n, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground/50 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-foreground truncate">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground capitalize shrink-0">{n.type}</span>
                          </div>
                          <MiniBar pct={n.readRate} color="#10B981" />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-foreground">{n.readRate}%</p>
                          <p className="text-[10px] text-muted-foreground">{n.reads}/{n.recipients}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Compose ───────────────────────────────────────────────── */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> Send Message
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["announcement", "feature", "warning", "maintenance", "tip"] as const).map(t => (
                          <button key={t} onClick={() => setMsgForm(f => ({ ...f, type: t }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${msgForm.type === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Target Segment</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["all", "free", "pro", "startup", "enterprise", "individual"] as const).map(t => (
                          <button key={t} onClick={() => setMsgForm(f => ({ ...f, target: t }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${msgForm.target === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {msgForm.target === "individual" && (
                    <input type="text" placeholder="User ID (UUID)..." value={msgForm.targetUserId} onChange={e => setMsgForm(f => ({ ...f, targetUserId: e.target.value }))}
                      className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none font-mono text-xs" />
                  )}
                  <input type="text" placeholder="Title..." value={msgForm.title} onChange={e => setMsgForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
                  <textarea placeholder="Message body..." value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))}
                    rows={3} className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none" />
                  <div className="flex items-center gap-3">
                    <button onClick={async () => {
                      if (!msgForm.title.trim() || !msgForm.body.trim()) return
                      setSendingMsg(true)
                      try {
                        await fetch("/api/admin/message-center", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...msgForm }) })
                        setMsgSent(true)
                        setMsgForm({ target: "all", targetUserId: "", type: "announcement", title: "", body: "" })
                        await loadMessages()
                        setTimeout(() => setMsgSent(false), 3000)
                      } catch (_) {}
                      setSendingMsg(false)
                    }} disabled={sendingMsg || !msgForm.title.trim() || !msgForm.body.trim()}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {sendingMsg ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendingMsg ? "Sending..." : "Send Message"}
                    </button>
                    <AnimatePresence>
                      {msgSent && (
                        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <Check className="h-3.5 w-3.5" /> Message sent!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* ── Scheduled Notifications ───────────────────────────────── */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2 flex-1">
                    <Clock className="h-4 w-4 text-primary" /> Scheduled Notifications
                  </h3>
                  <button onClick={() => { setShowScheduleForm(v => !v); setScheduleError(null) }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-all">
                    <Plus className="h-3.5 w-3.5" /> Schedule
                  </button>
                </div>

                <AnimatePresence>
                  {showScheduleForm && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <h4 className="text-xs font-black text-foreground">New Scheduled Notification</h4>
                      {scheduleError && (
                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5" /> {scheduleError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {(["announcement", "feature", "warning", "maintenance", "tip"] as const).map(t => (
                              <button key={t} onClick={() => setScheduleForm(f => ({ ...f, type: t }))}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all capitalize ${scheduleForm.type === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Segment</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {(["all", "free", "pro", "startup", "enterprise"] as const).map(s => (
                              <button key={s} onClick={() => setScheduleForm(f => ({ ...f, segment: s }))}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all capitalize ${scheduleForm.segment === s ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <input type="text" placeholder="Title..." value={scheduleForm.title} onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
                      <textarea placeholder="Message body..." value={scheduleForm.message} onChange={e => setScheduleForm(f => ({ ...f, message: e.target.value }))}
                        rows={2} className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none" />
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Schedule For</p>
                        <input type="datetime-local" value={scheduleForm.scheduledFor} onChange={e => setScheduleForm(f => ({ ...f, scheduledFor: e.target.value }))}
                          className="rounded-xl border border-white/8 bg-white/3 px-4 py-2 text-sm text-foreground outline-none focus:border-primary/30" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          setScheduleError(null)
                          if (!scheduleForm.title.trim() || !scheduleForm.message.trim() || !scheduleForm.scheduledFor) {
                            setScheduleError("Title, message, and schedule time are required"); return
                          }
                          setCreatingSchedule(true)
                          try {
                            const r = await fetch("/api/admin/notification-schedules", {
                              method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ...scheduleForm, scheduledFor: new Date(scheduleForm.scheduledFor).toISOString() }),
                            })
                            const d = await r.json()
                            if (!r.ok) { setScheduleError(d.error ?? "Failed to create"); setCreatingSchedule(false); return }
                            setScheduleForm({ title: "", message: "", type: "announcement", segment: "all", scheduledFor: "" })
                            setShowScheduleForm(false)
                            await loadMessages()
                          } catch (_) { setScheduleError("Request failed") }
                          setCreatingSchedule(false)
                        }} disabled={creatingSchedule}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40">
                          {creatingSchedule ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Schedule
                        </button>
                        <button onClick={() => { setShowScheduleForm(false); setScheduleError(null) }}
                          className="px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground border border-white/8 bg-white/3 transition-all">
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {schedules.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No scheduled notifications</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s, i) => {
                      const isPast = s.status === "sent"
                      const isCancelled = s.status === "cancelled"
                      return (
                        <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                          className={`rounded-xl border bg-white/2 px-4 py-3 ${isPast || isCancelled ? "border-white/4 opacity-60" : "border-white/8"}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold text-foreground truncate">{s.title}</span>
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold capitalize"
                                  style={{
                                    background: s.status === "pending" ? "#6366F115" : s.status === "sent" ? "#10B98115" : "#6B728015",
                                    color: s.status === "pending" ? "#6366F1" : s.status === "sent" ? "#10B981" : "#6B7280",
                                    border: `1px solid ${s.status === "pending" ? "#6366F130" : s.status === "sent" ? "#10B98130" : "#6B728030"}`,
                                  }}>
                                  {s.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize">{s.type} · {s.segment}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground/70 truncate">{s.message}</p>
                              <p className="text-[10px] text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(s.scheduledFor).toLocaleString()}
                                {s.sentAt && <span className="ml-2 text-emerald-400">· sent {timeAgo(s.sentAt)}</span>}
                              </p>
                            </div>
                            {s.status === "pending" && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={async () => {
                                  setCancellingSchedule(s.id)
                                  await fetch(`/api/admin/notification-schedules/${s.id}/cancel`, { method: "PATCH", credentials: "include" })
                                  await loadMessages()
                                  setCancellingSchedule(null)
                                }} disabled={cancellingSchedule === s.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-yellow-400 hover:border-yellow-500/20 transition-all">
                                  <Pause className="h-2.5 w-2.5" /> Cancel
                                </button>
                                <button onClick={async () => {
                                  await fetch(`/api/admin/notification-schedules/${s.id}`, { method: "DELETE", credentials: "include" })
                                  await loadMessages()
                                }} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            {(s.status === "sent" || s.status === "cancelled") && (
                              <button onClick={async () => {
                                await fetch(`/api/admin/notification-schedules/${s.id}`, { method: "DELETE", credentials: "include" })
                                await loadMessages()
                              }} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors shrink-0">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Sent Messages History ─────────────────────────────────── */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Sent Messages
                  <span className="text-[10px] font-bold text-muted-foreground/60 bg-white/5 rounded-full px-2 py-0.5">{messageSends.length}</span>
                </h3>

                {messageSends.length === 0 ? (
                  <div className="py-10 text-center">
                    <Send className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No messages sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messageSends.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        className="rounded-xl border border-white/6 bg-white/2 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-foreground truncate">{m.title}</span>
                              <span className="text-[10px] text-muted-foreground capitalize shrink-0">{m.type}</span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 capitalize shrink-0">{m.segment}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{m.recipientCount} recipients</span>
                              <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{timeAgo(m.createdAt)}</span>
                              <span>{m.adminEmail}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => setViewingMsg(viewingMsg === m.id ? null : m.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all">
                              <Eye className="h-2.5 w-2.5" /> {viewingMsg === m.id ? "Hide" : "View"}
                            </button>
                            <button onClick={async () => {
                              setDeletingMsgSend(m.id)
                              await fetch(`/api/admin/message-center/${m.id}`, { method: "DELETE", credentials: "include" })
                              setMessageSends(prev => prev.filter(s => s.id !== m.id))
                              setDeletingMsgSend(null)
                            }} disabled={deletingMsgSend === m.id}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {viewingMsg === m.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/6 px-4 py-3 bg-white/1">
                              <p className="text-xs text-muted-foreground leading-relaxed">{m.message}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Broadcasts Tab ─────────────────────────────────────────────── */}
          {activeTab === "broadcasts" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" /> Compose Broadcast
                  </h3>
                  {segmentCounts?.emailEnabled && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                      <Check className="h-2.5 w-2.5" /> Email delivery enabled
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <input type="text" placeholder="Subject / title..." value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
                  <textarea placeholder="Write your message to users..." value={broadcastForm.message} onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                    rows={4} className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors resize-none" />
                  <div className="flex gap-5 flex-wrap">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                      <div className="flex gap-2">
                        {(["info", "update", "feature", "warning"] as const).map(t => {
                          const meta = BROADCAST_TYPE_META[t]
                          return (
                            <button key={t} onClick={() => setBroadcastForm(f => ({ ...f, type: t }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${broadcastForm.type === t ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}
                              style={broadcastForm.type === t ? { background: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color } : {}}>
                              {meta.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Segment</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["all", "free", "pro", "startup", "enterprise"] as const).map(t => {
                          const cnt = segmentCounts ? segmentCounts[t] : null
                          return (
                            <button key={t} onClick={() => setBroadcastForm(f => ({ ...f, target: t }))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${broadcastForm.target === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                              {t}
                              {cnt !== null && <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${broadcastForm.target === t ? "bg-primary/20 text-primary" : "bg-white/8 text-muted-foreground/60"}`}>{cnt}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  {segmentCounts?.emailEnabled && (
                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={() => setSendEmail(v => !v)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${sendEmail ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        <Mail className="h-3.5 w-3.5" />
                        {sendEmail ? "Email delivery ON" : "Also send via email"}
                      </button>
                      {(broadcastForm.title.trim() || broadcastForm.message.trim()) && (
                        <button onClick={() => setShowEmailPreview(v => !v)}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                          {showEmailPreview ? "Hide preview" : "Preview email"}
                        </button>
                      )}
                    </div>
                  )}
                  <AnimatePresence>
                    {showEmailPreview && (broadcastForm.title.trim() || broadcastForm.message.trim()) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl border border-white/8">
                        <iframe key={`${broadcastForm.title}|${broadcastForm.message}|${broadcastForm.type}`}
                          src={`/api/admin/broadcasts/preview-email?title=${encodeURIComponent(broadcastForm.title || "Broadcast Title")}&message=${encodeURIComponent(broadcastForm.message || "Your message here.")}&type=${broadcastForm.type}`}
                          className="w-full border-0" style={{ height: 460, background: "#0a0a0f" }} title="Email preview" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={handleSendBroadcast}
                      disabled={sendingBroadcast || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {sendingBroadcast ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendingBroadcast ? "Sending..." : `Send to ${segmentCounts?.[broadcastForm.target as keyof SegmentCounts] ?? "?"} users`}
                    </button>
                    <AnimatePresence>
                      {broadcastSent && (
                        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <Check className="h-3.5 w-3.5" /> Sent!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Broadcast History</h3>
                {broadcasts.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center text-muted-foreground">
                    <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No broadcasts sent yet</p>
                  </div>
                ) : broadcasts.map(b => {
                  const meta = BROADCAST_TYPE_META[b.type] ?? BROADCAST_TYPE_META.info
                  return (
                    <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>{meta.label}</span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-white/5 text-muted-foreground border border-white/8 capitalize">→ {b.target}</span>
                            {(b.deliveredCount ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Users className="h-2.5 w-2.5" /> {b.deliveredCount} delivered
                              </span>
                            )}
                            {b.emailDelivered && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <Mail className="h-2.5 w-2.5" /> emailed
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground">{b.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.message}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(b.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteBroadcast(b.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Waitlist Tab ───────────────────────────────────────────────── */}
          {activeTab === "waitlist" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-foreground flex-1">Waitlist</h2>
                <div className="flex gap-1">
                  {(["all", "enterprise", "beta"] as const).map(f => (
                    <button key={f} onClick={() => setWaitlistFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize ${waitlistFilter === f ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {f === "all" ? "All" : `${f.charAt(0).toUpperCase()}${f.slice(1)}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total Entries" value={waitlist.length} icon={UserCheck} color="#6366F1" />
                <StatCard label="Enterprise" value={waitlist.filter(w => w.plan === "enterprise").length} icon={Building2} color="#8B5CF6" />
                <StatCard label="Beta" value={waitlist.filter(w => w.plan === "beta").length} icon={Zap} color="#D4AF37" />
              </div>

              {waitlist.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/2 py-20 text-center">
                  <UserCheck className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No waitlist entries</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                  <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <span className="col-span-2">Name / Email</span>
                    <span>Company</span>
                    <span>List</span>
                    <span>Joined</span>
                  </div>
                  {waitlist.map((w, i) => (
                    <motion.div key={w.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-5 gap-4 items-center px-5 py-3.5 border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors group">
                      <div className="col-span-2">
                        <p className="text-xs font-bold text-foreground">{w.name}</p>
                        <p className="text-[10px] text-muted-foreground">{w.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">—</span>
                      <span>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                          style={{ background: w.plan === "enterprise" ? "#8B5CF615" : "#D4AF3715", color: w.plan === "enterprise" ? "#8B5CF6" : "#D4AF37", border: `1px solid ${w.plan === "enterprise" ? "#8B5CF630" : "#D4AF3730"}` }}>
                          {w.plan}
                        </span>
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(w.createdAt)}</span>
                        <button onClick={() => handleDeleteWaitlist(w.id)} disabled={deletingWaitlist === w.id}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Coupons Tab ────────────────────────────────────────────────── */}
          {activeTab === "coupons" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-foreground flex-1">Coupon System</h2>
                <AnimatePresence>
                  {couponSuccess && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                      <Check className="h-3.5 w-3.5" /> Coupon created!
                    </motion.span>
                  )}
                </AnimatePresence>
                <button onClick={() => setShowCouponForm(v => !v)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-all">
                  <Plus className="h-3.5 w-3.5" /> New Coupon
                </button>
              </div>

              {/* Create form */}
              <AnimatePresence>
                {showCouponForm && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                    <h3 className="text-sm font-black text-foreground">Create Coupon</h3>
                    {couponError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5" /> {couponError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Code</p>
                        <input type="text" placeholder="SAVE20" value={couponForm.code}
                          onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                          className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm font-mono font-bold text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                        <div className="flex gap-2">
                          {(["percentage", "fixed"] as const).map(t => (
                            <button key={t} onClick={() => setCouponForm(f => ({ ...f, type: t }))}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${couponForm.type === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                              {t === "percentage" ? <Percent className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                              {t === "percentage" ? "%" : "$"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Value</p>
                        <input type="number" placeholder={couponForm.type === "percentage" ? "20" : "10"} value={couponForm.value}
                          onChange={e => setCouponForm(f => ({ ...f, value: e.target.value }))}
                          className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Max Uses (optional)</p>
                        <input type="number" placeholder="Unlimited" value={couponForm.maxUses}
                          onChange={e => setCouponForm(f => ({ ...f, maxUses: e.target.value }))}
                          className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Expires (optional)</p>
                        <input type="date" value={couponForm.expiresAt}
                          onChange={e => setCouponForm(f => ({ ...f, expiresAt: e.target.value }))}
                          className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
                        <input type="text" placeholder="e.g. Launch promo" value={couponForm.description}
                          onChange={e => setCouponForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCreateCoupon} disabled={creatingCoupon}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40">
                        {creatingCoupon ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create Coupon
                      </button>
                      <button onClick={() => { setShowCouponForm(false); setCouponError(null) }}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground border border-white/8 bg-white/3 transition-all">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Coupon list */}
              {coupons.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/2 py-20 text-center">
                  <Tag className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No coupons created yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {coupons.map((c, i) => {
                    const expired = c.expiresAt && new Date(c.expiresAt) < new Date()
                    const exhausted = c.maxUses !== null && c.uses >= c.maxUses
                    const active = !c.disabled && !expired && !exhausted
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className={`rounded-2xl border bg-white/2 px-5 py-4 ${active ? "border-white/8" : "border-white/4 opacity-60"}`}>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-black text-primary tracking-wider">{c.code}</code>
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ background: active ? "#10B98115" : "#6B728015", color: active ? "#10B981" : "#6B7280", border: `1px solid ${active ? "#10B98130" : "#6B728030"}` }}>
                                {c.disabled ? "Disabled" : expired ? "Expired" : exhausted ? "Exhausted" : "Active"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="font-bold text-foreground">
                                {c.type === "percentage" ? `${c.value}% off` : `$${c.value} off`}
                              </span>
                              <span>{c.uses} uses{c.maxUses ? ` / ${c.maxUses} max` : ""}</span>
                              {c.expiresAt && <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Expires {new Date(c.expiresAt).toLocaleDateString()}</span>}
                              {c.description && <span className="italic">{c.description}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleToggleCoupon(c.id, c.disabled)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${c.disabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"}`}>
                              {c.disabled ? <><Play className="h-3 w-3" /> Enable</> : <><Pause className="h-3 w-3" /> Disable</>}
                            </button>
                            <button onClick={() => handleDeleteCoupon(c.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Audit Log Tab ──────────────────────────────────────────────── */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-black text-foreground">Audit Log</h2>
                <div className="relative flex-1 min-w-40">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Filter by action, user, resource..." value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
                </div>
                <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-foreground px-3 py-2 outline-none cursor-pointer">
                  <option value="all" className="bg-[#1a1a1a]">All Actions</option>
                  {Object.entries(ACTION_META).map(([k, v]) => (
                    <option key={k} value={k} className="bg-[#1a1a1a]">{v.label}</option>
                  ))}
                </select>
                <select value={auditSeverity} onChange={e => setAuditSeverity(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-foreground px-3 py-2 outline-none cursor-pointer">
                  <option value="all" className="bg-[#1a1a1a]">All Severities</option>
                  {Object.entries(SEVERITY_META).map(([k, v]) => (
                    <option key={k} value={k} className="bg-[#1a1a1a]">{v.label}</option>
                  ))}
                </select>
              </div>

              {filteredAudit.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/2 py-20 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">No audit log entries</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredAudit.map((l, i) => (
                    <motion.div key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                      className="rounded-xl border border-white/6 bg-white/2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ActionBadge action={l.action} />
                        <SeverityBadge severity={l.severity} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate">
                              {l.userName ?? l.userEmail ?? "System"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">→ {l.resource}{l.resourceId ? ` #${l.resourceId.slice(0, 8)}` : ""}</span>
                          </div>
                          {l.changes && Object.keys(l.changes).length > 0 && (
                            <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                              {JSON.stringify(l.changes).slice(0, 80)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeAgo(l.createdAt)}</span>
                        <span className={`text-[10px] font-bold shrink-0 ${l.outcome === "success" ? "text-emerald-400" : "text-red-400"}`}>
                          {l.outcome}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Session Monitor Tab ─────────────────────────────────────────── */}
          {activeTab === "sessions" && (
            <div className="space-y-5">
              {/* Header + live indicator */}
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-emerald-400" />
                  Real-Time Session Monitor
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE · refreshes every 30s
                </span>
              </div>

              {!sessionData ? (
                <div className="flex items-center justify-center py-24">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <>
                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Active Users Now" value={sessionData.stats?.activeNow ?? 0} icon={Wifi} color="#10B981"
                      sub="heartbeat < 2 min ago" />
                    <StatCard label="Sessions Today" value={sessionData.stats?.sessionsToday ?? 0} icon={Activity} color="#6366F1" />
                    <StatCard label="Avg Session Length" value={formatDuration(sessionData.stats?.avgDurationMs ?? 0)} icon={Clock} color="#D4AF37" />
                    <StatCard label="Total Tracked" value={sessionData.sessions?.length ?? 0} icon={Monitor} color="#8B5CF6" />
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-40">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by email or name..."
                        value={sessionSearch}
                        onChange={e => setSessionSearch(e.target.value)}
                        className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>
                    <select value={sessionStatusFilter} onChange={e => setSessionStatusFilter(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-foreground px-3 py-2 outline-none cursor-pointer">
                      <option value="all" className="bg-[#1a1a1a]">All Status</option>
                      <option value="online" className="bg-[#1a1a1a]">● Online</option>
                      <option value="offline" className="bg-[#1a1a1a]">○ Offline</option>
                    </select>
                    <select value={sessionPlanFilter} onChange={e => setSessionPlanFilter(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-foreground px-3 py-2 outline-none cursor-pointer">
                      <option value="all" className="bg-[#1a1a1a]">All Plans</option>
                      <option value="free" className="bg-[#1a1a1a]">Free</option>
                      <option value="pro" className="bg-[#1a1a1a]">Pro</option>
                      <option value="startup" className="bg-[#1a1a1a]">Startup</option>
                      <option value="enterprise" className="bg-[#1a1a1a]">Enterprise</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground shrink-0">{filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Sessions Table */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                    {filteredSessions.length === 0 ? (
                      <div className="py-20 text-center">
                        <Monitor className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">No sessions found</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">Sessions appear after users log in</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="border-b border-white/6">
                            <tr className="text-muted-foreground text-[10px] uppercase tracking-wider">
                              <th className="text-left px-4 py-3 font-semibold">Status</th>
                              <th className="text-left px-4 py-3 font-semibold">User</th>
                              <th className="text-left px-4 py-3 font-semibold">Plan</th>
                              <th className="text-left px-4 py-3 font-semibold">Location</th>
                              <th className="text-left px-4 py-3 font-semibold">Browser / OS</th>
                              <th className="text-left px-4 py-3 font-semibold">Current Page</th>
                              <th className="text-left px-4 py-3 font-semibold">Duration</th>
                              <th className="text-left px-4 py-3 font-semibold">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSessions.map((s, i) => (
                              <motion.tr
                                key={s.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.01 }}
                                className="border-b border-white/4 hover:bg-white/2 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${s.isOnline ? "text-emerald-400" : "text-muted-foreground/60"}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${s.isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                                    {s.isOnline ? "Online" : "Offline"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-bold text-foreground truncate max-w-[140px]">{s.userName ?? "—"}</p>
                                    <p className="text-muted-foreground/60 text-[10px] truncate max-w-[140px]">{s.userEmail ?? "—"}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <PlanBadge plan={(s.plan ?? "free") as Plan} />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-muted-foreground">
                                    {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-muted-foreground">
                                    <p className="font-medium">{s.browser ?? "Unknown"}</p>
                                    <p className="text-[10px] opacity-60">{[s.os, s.device].filter(Boolean).join(" · ") || "—"}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <code className="text-[10px] font-mono text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                                    {s.currentPage ?? "—"}
                                  </code>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-muted-foreground tabular-nums">{formatDuration(s.durationMs)}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-muted-foreground/60 text-[10px] tabular-nums">{timeAgo(s.lastSeenAt)}</span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Geo Heatmap */}
                  {(() => {
                    // Aggregate country + city + device counts from live session data
                    const countryCounts: Record<string, { total: number; online: number }> = {}
                    const cityCounts: Record<string, { country: string | null; total: number; online: number }> = {}
                    const deviceCounts: Record<string, number> = {}
                    const browserCounts: Record<string, number> = {}
                    for (const s of sessionData.sessions) {
                      const c = s.country ?? "Unknown"
                      if (!countryCounts[c]) countryCounts[c] = { total: 0, online: 0 }
                      countryCounts[c].total++
                      if (s.isOnline) countryCounts[c].online++

                      if (s.city) {
                        const key = `${s.city}||${c}`
                        if (!cityCounts[key]) cityCounts[key] = { country: s.country, total: 0, online: 0 }
                        cityCounts[key].total++
                        if (s.isOnline) cityCounts[key].online++
                      }

                      const dev = s.device ?? "Desktop"
                      deviceCounts[dev] = (deviceCounts[dev] ?? 0) + 1

                      const br = s.browser ?? "Unknown"
                      browserCounts[br] = (browserCounts[br] ?? 0) + 1
                    }

                    const topCountries = Object.entries(countryCounts)
                      .sort((a, b) => b[1].total - a[1].total)
                      .slice(0, 10)
                    const topCities = Object.entries(cityCounts)
                      .sort((a, b) => b[1].total - a[1].total)
                      .slice(0, 8)
                    const topDevices = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])
                    const topBrowsers = Object.entries(browserCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

                    const maxCountry = topCountries[0]?.[1]?.total ?? 1
                    const maxCity = topCities[0]?.[1]?.total ?? 1

                    const DEVICE_COLOR: Record<string, string> = {
                      Desktop: "#6366F1", Mobile: "#10B981", Tablet: "#F59E0B",
                    }
                    const BROWSER_COLOR: Record<string, string> = {
                      Chrome: "#4285F4", Firefox: "#FF7139", Safari: "#0FB5EE",
                      Edge: "#0078D4", Opera: "#FF1B2D", Chromium: "#6B7280", Unknown: "#6B7280",
                    }

                    return (
                      <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-5">
                        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                          <Globe className="h-4 w-4 text-sky-400" />
                          Geographic Distribution
                        </h3>

                        {topCountries.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No location data yet — sessions populate as users log in</p>
                        ) : (
                          <div className="grid md:grid-cols-2 gap-5">
                            {/* Countries */}
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Top Countries</p>
                              <div className="space-y-2">
                                {topCountries.map(([country, { total, online }], i) => {
                                  const pct = Math.round((total / maxCountry) * 100)
                                  const isUnknown = country === "Unknown"
                                  return (
                                    <motion.div key={country} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.04 }} className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-base leading-none w-6 shrink-0 text-center">
                                          {isUnknown ? "🌍" : countryFlag(country)}
                                        </span>
                                        <span className="text-xs text-foreground font-medium flex-1 truncate">
                                          {isUnknown ? "Unknown" : country}
                                        </span>
                                        {online > 0 && (
                                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 shrink-0">
                                            {online} live
                                          </span>
                                        )}
                                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-5 text-right shrink-0">
                                          {total}
                                        </span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-white/6 overflow-hidden ml-8">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${pct}%` }}
                                          transition={{ duration: 0.7, delay: i * 0.04 }}
                                          className="h-full rounded-full"
                                          style={{ background: i === 0 ? "#D4AF37" : i === 1 ? "#6366F1" : i === 2 ? "#10B981" : "#4B5563" }}
                                        />
                                      </div>
                                    </motion.div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Right column: cities + device + browser */}
                            <div className="space-y-5">
                              {/* Top Cities */}
                              {topCities.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Top Cities</p>
                                  <div className="space-y-1.5">
                                    {topCities.map(([key, { country, total, online }], i) => {
                                      const city = key.split("||")[0]
                                      const pct = Math.round((total / maxCity) * 100)
                                      return (
                                        <motion.div key={key} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: i * 0.04 }} className="space-y-0.5">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm w-5 text-center shrink-0">
                                              {countryFlag(country ?? null)}
                                            </span>
                                            <span className="text-xs text-foreground flex-1 truncate">{city}</span>
                                            {online > 0 && (
                                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 shrink-0">
                                                {online}●
                                              </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground tabular-nums">{total}</span>
                                          </div>
                                          <div className="h-1 rounded-full bg-white/5 overflow-hidden ml-7">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${pct}%` }}
                                              transition={{ duration: 0.6, delay: i * 0.04 }}
                                              className="h-full rounded-full bg-sky-400/60"
                                            />
                                          </div>
                                        </motion.div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Device breakdown */}
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Device Types</p>
                                <div className="flex gap-2 flex-wrap">
                                  {topDevices.map(([device, count]) => (
                                    <div key={device} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border"
                                      style={{ background: `${DEVICE_COLOR[device] ?? "#6B7280"}10`, borderColor: `${DEVICE_COLOR[device] ?? "#6B7280"}25` }}>
                                      <span className="text-[10px] font-bold" style={{ color: DEVICE_COLOR[device] ?? "#6B7280" }}>{device}</span>
                                      <span className="text-[10px] text-muted-foreground">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Browser breakdown */}
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Browsers</p>
                                <div className="flex gap-2 flex-wrap">
                                  {topBrowsers.map(([browser, count]) => (
                                    <div key={browser} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border"
                                      style={{ background: `${BROWSER_COLOR[browser] ?? "#6B7280"}10`, borderColor: `${BROWSER_COLOR[browser] ?? "#6B7280"}25` }}>
                                      <span className="text-[10px] font-bold" style={{ color: BROWSER_COLOR[browser] ?? "#6B7280" }}>{browser}</span>
                                      <span className="text-[10px] text-muted-foreground">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Activity Feed */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-400" />
                      Recent Activity Feed
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">last 24h</span>
                    </h3>
                    {sessionActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                    ) : (
                      <div className="space-y-1">
                        {sessionActivity.slice(0, 25).map((ev, i) => (
                          <motion.div
                            key={ev.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.015 }}
                            className="flex items-center gap-3 py-2 border-b border-white/4 last:border-0"
                          >
                            <EventTypeBadge type={ev.type} />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-foreground font-medium truncate">
                                {ev.userName ?? ev.userEmail ?? "Anonymous"}
                              </span>
                              {ev.city && (
                                <span className="text-[10px] text-muted-foreground/60 ml-2">
                                  {[ev.city, ev.country].filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                              {timeAgo(ev.createdAt)}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Admin Audit Logs Tab ────────────────────────────────────────── */}
          {activeTab === "audit-logs" && (() => {
            const AUDIT_ACTION_META: Record<string, { label: string; color: string; category: "create" | "update" | "destructive" | "notification" }> = {
              promote_admin:     { label: "Promote Admin",       color: "#10B981", category: "create" },
              demote_admin:      { label: "Demote Admin",        color: "#F59E0B", category: "update" },
              change_plan:       { label: "Change Plan",         color: "#D4AF37", category: "update" },
              delete_user:       { label: "Delete User",         color: "#EF4444", category: "destructive" },
              suspend_account:   { label: "Suspend Account",     color: "#EF4444", category: "destructive" },
              reactivate_account:{ label: "Reactivate Account",  color: "#10B981", category: "create" },
              reset_usage:       { label: "Reset Usage",         color: "#F97316", category: "update" },
              send_notification: { label: "Send Notification",   color: "#6366F1", category: "notification" },
              delete_notification:{ label: "Delete Notification",color: "#EF4444", category: "destructive" },
              send_broadcast:    { label: "Send Broadcast",      color: "#6366F1", category: "notification" },
              delete_broadcast:  { label: "Delete Broadcast",    color: "#F97316", category: "destructive" },
            }
            const CATEGORY_COLOR: Record<string, string> = {
              create:       "#10B981",
              update:       "#D4AF37",
              destructive:  "#EF4444",
              notification: "#6366F1",
            }
            const meta = (action: string) => AUDIT_ACTION_META[action] ?? { label: action, color: "#6B7280", category: "update" as const }
            const totalPages = Math.ceil(adminAuditTotal / 50)

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-amber-400" />
                    Admin Audit Logs
                  </h2>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5">
                    {adminAuditTotal} total entries
                  </span>
                  <button onClick={loadAdminAuditLogs}
                    className="ml-auto text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                {/* Color legend */}
                <div className="flex items-center gap-3 flex-wrap">
                  {(["create", "update", "destructive", "notification"] as const).map(cat => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} />
                      <span className="text-[10px] capitalize text-muted-foreground font-medium">{cat}</span>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input value={adminAuditSearch} onChange={e => { setAdminAuditSearch(e.target.value); setAdminAuditPage(0) }}
                      placeholder="Search by email or action…"
                      className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500/40 transition-colors" />
                  </div>
                  <select value={adminAuditAction} onChange={e => { setAdminAuditAction(e.target.value); setAdminAuditPage(0) }}
                    className="bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-foreground px-3 py-2 outline-none cursor-pointer">
                    <option value="all" className="bg-[#1a1a1a]">All Actions</option>
                    {Object.entries(AUDIT_ACTION_META).map(([k, v]) => (
                      <option key={k} value={k} className="bg-[#1a1a1a]">{v.label}</option>
                    ))}
                  </select>
                  <input type="date" value={adminAuditFrom} onChange={e => { setAdminAuditFrom(e.target.value); setAdminAuditPage(0) }}
                    className="bg-white/5 border border-white/10 rounded-xl text-xs text-foreground px-3 py-2 outline-none cursor-pointer" />
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <input type="date" value={adminAuditTo} onChange={e => { setAdminAuditTo(e.target.value); setAdminAuditPage(0) }}
                    className="bg-white/5 border border-white/10 rounded-xl text-xs text-foreground px-3 py-2 outline-none cursor-pointer" />
                  {(adminAuditSearch || adminAuditAction !== "all" || adminAuditFrom || adminAuditTo) && (
                    <button onClick={() => { setAdminAuditSearch(""); setAdminAuditAction("all"); setAdminAuditFrom(""); setAdminAuditTo(""); setAdminAuditPage(0) }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-red-400 flex items-center gap-1 transition-colors">
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>

                {/* Log entries */}
                {adminAuditLogs.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/2 py-20 text-center">
                    <ClipboardList className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No audit log entries yet</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">Admin actions will appear here as they are performed</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {adminAuditLogs.map((log, i) => {
                      const m = meta(log.action)
                      const isExpanded = expandedAuditLog === log.id
                      const hasDetails = log.details && Object.keys(log.details).length > 0
                      return (
                        <motion.div key={log.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                          className="rounded-xl border border-white/6 bg-white/2 overflow-hidden">
                          {/* Row */}
                          <div
                            className={`flex items-center gap-3 px-4 py-3 ${hasDetails ? "cursor-pointer hover:bg-white/3" : ""} transition-colors`}
                            onClick={() => hasDetails ? setExpandedAuditLog(isExpanded ? null : log.id) : undefined}>
                            {/* Color dot */}
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: CATEGORY_COLOR[m.category] }} />

                            {/* Action badge */}
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0"
                              style={{ color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                              {m.label}
                            </span>

                            {/* Admin → target */}
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                              <span className="font-semibold text-foreground truncate">{log.adminEmail}</span>
                              {log.targetUserEmail && (
                                <>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground truncate">{log.targetUserEmail}</span>
                                </>
                              )}
                            </div>

                            {/* IP hash */}
                            {log.ipHash && (
                              <code className="text-[9px] font-mono text-muted-foreground/40 hidden md:block shrink-0">
                                {log.ipHash.slice(0, 8)}…
                              </code>
                            )}

                            {/* Timestamp */}
                            <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">{timeAgo(log.createdAt)}</span>

                            {/* Expand chevron */}
                            {hasDetails && (
                              <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </div>

                          {/* Expanded detail view */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-white/6">
                                <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Meta fields */}
                                  <div className="space-y-2">
                                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Record</p>
                                    {[
                                      { label: "Admin ID",    value: log.adminId },
                                      { label: "Admin Email", value: log.adminEmail },
                                      { label: "Action",      value: log.action },
                                      { label: "Target ID",   value: log.targetUserId ?? "—" },
                                      { label: "Target",      value: log.targetUserEmail ?? "—" },
                                      { label: "IP Hash",     value: log.ipHash ?? "—" },
                                      { label: "Timestamp",   value: new Date(log.createdAt).toLocaleString() },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="flex items-start gap-2">
                                        <span className="text-[10px] text-muted-foreground/60 w-20 shrink-0 font-medium">{label}</span>
                                        <code className="text-[10px] font-mono text-foreground/80 break-all">{value}</code>
                                      </div>
                                    ))}
                                  </div>
                                  {/* Details JSON */}
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Metadata</p>
                                    <pre className="text-[10px] font-mono text-foreground/70 bg-white/4 border border-white/8 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      Page {adminAuditPage + 1} of {totalPages} · {adminAuditTotal} entries
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setAdminAuditPage(p => Math.max(0, p - 1))} disabled={adminAuditPage === 0}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground disabled:opacity-30 hover:bg-white/8 transition-colors">
                        ← Prev
                      </button>
                      <button onClick={() => setAdminAuditPage(p => Math.min(totalPages - 1, p + 1))} disabled={adminAuditPage >= totalPages - 1}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground disabled:opacity-30 hover:bg-white/8 transition-colors">
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Geo Intelligence Tab ──────────────────────────────────────────── */}
          {activeTab === "geo" && (() => {
            const geo = geoData
            const q = geoSearch.toLowerCase()

            const filteredCountries = (geo?.countries ?? []).filter(c =>
              !q || c.country.toLowerCase().includes(q)
            )
            const filteredCities = (geo?.cities ?? []).filter(c =>
              !q || c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
            )
            const filteredTimezones = (geo?.timezones ?? []).filter(t =>
              !q || t.timezone.toLowerCase().includes(q)
            )
            const filteredGrowth = (geo?.growth ?? []).filter(g =>
              !q || g.country.toLowerCase().includes(q)
            )

            const topCountries = (geo?.countries ?? []).slice(0, 10)
            const topCities    = (geo?.cities ?? []).slice(0, 10)
            const maxCountryUsers = topCountries[0]?.users ?? 1
            const maxCityUsers    = topCities[0]?.users    ?? 1

            const flagEmoji = (country: string) => {
              const map: Record<string, string> = {
                "United States": "🇺🇸", "USA": "🇺🇸", "US": "🇺🇸",
                "United Kingdom": "🇬🇧", "UK": "🇬🇧", "GB": "🇬🇧",
                "Canada": "🇨🇦", "CA": "🇨🇦",
                "Germany": "🇩🇪", "DE": "🇩🇪",
                "France": "🇫🇷", "FR": "🇫🇷",
                "Australia": "🇦🇺", "AU": "🇦🇺",
                "India": "🇮🇳", "IN": "🇮🇳",
                "Brazil": "🇧🇷", "BR": "🇧🇷",
                "Japan": "🇯🇵", "JP": "🇯🇵",
                "Netherlands": "🇳🇱", "NL": "🇳🇱",
                "Sweden": "🇸🇪", "SE": "🇸🇪",
                "Spain": "🇪🇸", "ES": "🇪🇸",
                "Italy": "🇮🇹", "IT": "🇮🇹",
                "Mexico": "🇲🇽", "MX": "🇲🇽",
                "Singapore": "🇸🇬", "SG": "🇸🇬",
                "South Korea": "🇰🇷", "KR": "🇰🇷",
                "Poland": "🇵🇱", "PL": "🇵🇱",
                "Norway": "🇳🇴", "NO": "🇳🇴",
                "Denmark": "🇩🇰", "DK": "🇩🇰",
                "Switzerland": "🇨🇭", "CH": "🇨🇭",
              }
              return map[country] ?? "🌐"
            }

            return (
              <div className="space-y-5">

                {/* Globe */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/8 bg-white/2 p-6 flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 self-start">
                    <Globe className="h-4 w-4 text-[#6366F1]" />
                    <h3 className="text-sm font-black text-foreground">Global User Distribution</h3>
                    {geo?.countries && geo.countries.length > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {geo.countries.length} countr{geo.countries.length !== 1 ? "ies" : "y"} · {geo.countries.reduce((s, c) => s + c.users, 0).toLocaleString()} users
                      </span>
                    )}
                  </div>
                  {(!geo?.countries || geo.countries.length === 0) ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                      <Globe className="h-10 w-10 opacity-20" />
                      <p className="text-xs">No geo data yet — data appears as users sign up</p>
                    </div>
                  ) : (
                    <GeoWorldMap countries={geo.countries} />
                  )}
                  {geo?.countries && geo.countries.length > 0 && (
                    <div className="flex flex-wrap gap-4 self-start">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                        <span className="text-[10px] text-muted-foreground">Active users</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                        <span className="text-[10px] text-muted-foreground">Registered users</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-[10px] text-muted-foreground">Dot size = user count</span>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {([
                    { label: "Countries Reached", value: String(geo?.overview.totalCountries ?? 0), icon: Globe,       color: "#6366F1" },
                    { label: "Cities Reached",    value: String(geo?.overview.totalCities    ?? 0), icon: MapPin,      color: "#10B981" },
                    { label: "Top Country",       value: geo?.overview.topCountry  ?? "—",          icon: TrendingUp,  color: "#D4AF37" },
                    { label: "Top City",          value: geo?.overview.topCity     ?? "—",          icon: MapPin,      color: "#8B5CF6" },
                    { label: "Top Timezone",      value: geo?.overview.topTimezone ?? "—",          icon: Clock,       color: "#EF4444" },
                  ] as { label: string; value: string; icon: React.ElementType; color: string }[]).map(({ label, value, icon: Icon, color }) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
                      </div>
                      <p className="text-xl font-black text-foreground truncate">{value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Top Countries Bar Chart */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-[#6366F1]" /> Top Countries
                    </h3>
                    <div className="space-y-2.5">
                      {topCountries.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No geo data yet</p>
                      ) : topCountries.map((c, i) => (
                        <div key={c.country} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground flex items-center gap-1.5">
                              <span>{flagEmoji(c.country)}</span>
                              <span className="font-medium">{c.country}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">{c.users} users</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: i === 0 ? "#6366F1" : i === 1 ? "#8B5CF6" : "#A78BFA" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round((c.users / maxCountryUsers) * 100)}%` }}
                              transition={{ duration: 0.6, delay: i * 0.05 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Top Cities Bar Chart */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#10B981]" /> Top Cities
                    </h3>
                    <div className="space-y-2.5">
                      {topCities.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No geo data yet</p>
                      ) : topCities.map((c, i) => (
                        <div key={`${c.city}-${c.country}`} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground flex items-center gap-1.5">
                              <span>{flagEmoji(c.country)}</span>
                              <span className="font-medium">{c.city}</span>
                              <span className="text-muted-foreground text-[10px]">{c.country}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">{c.users} users</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: i === 0 ? "#10B981" : i === 1 ? "#34D399" : "#6EE7B7" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round((c.users / maxCityUsers) * 100)}%` }}
                              transition={{ duration: 0.6, delay: i * 0.05 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Data tables */}
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
                  {/* Header + Search + View toggle */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex gap-1 flex-wrap">
                      {(["countries", "cities", "timezones", "growth"] as const).map(v => (
                        <button key={v} onClick={() => setGeoView(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors capitalize ${
                            geoView === v ? "bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1]/30" : "bg-white/5 text-muted-foreground hover:text-foreground border border-white/8"
                          }`}>
                          {v === "countries" ? `Countries (${geo?.countries.length ?? 0})` :
                           v === "cities"    ? `Cities (${geo?.cities.length ?? 0})`       :
                           v === "timezones" ? `Timezones (${geo?.timezones.length ?? 0})` :
                                              `Growth 7d (${geo?.growth.length ?? 0})`}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1 max-w-xs ml-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input value={geoSearch} onChange={e => setGeoSearch(e.target.value)}
                        placeholder="Search…"
                        className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#6366F1]/50" />
                    </div>
                  </div>

                  {/* Countries table */}
                  {geoView === "countries" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/8">
                            <th className="text-left pb-2 text-muted-foreground font-semibold">#</th>
                            <th className="text-left pb-2 text-muted-foreground font-semibold">Country</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Users</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Sessions</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Active Now</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCountries.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No data</td></tr>
                          )}
                          {filteredCountries.map((c, i) => (
                            <tr key={c.country} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                              <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                              <td className="py-2.5">
                                <span className="flex items-center gap-2">
                                  <span className="text-base leading-none">{flagEmoji(c.country)}</span>
                                  <span className="font-medium text-foreground">{c.country}</span>
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-bold text-foreground">{c.users.toLocaleString()}</td>
                              <td className="py-2.5 text-right text-muted-foreground">{c.sessions.toLocaleString()}</td>
                              <td className="py-2.5 text-right">
                                {c.activeUsers > 0
                                  ? <span className="inline-flex items-center gap-1 text-[#10B981]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981] inline-block animate-pulse" />{c.activeUsers}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Cities table */}
                  {geoView === "cities" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/8">
                            <th className="text-left pb-2 text-muted-foreground font-semibold">#</th>
                            <th className="text-left pb-2 text-muted-foreground font-semibold">City</th>
                            <th className="text-left pb-2 text-muted-foreground font-semibold">Country</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Users</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Sessions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCities.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No data</td></tr>
                          )}
                          {filteredCities.map((c, i) => (
                            <tr key={`${c.city}-${c.country}`} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                              <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                              <td className="py-2.5 font-medium text-foreground">{c.city}</td>
                              <td className="py-2.5">
                                <span className="flex items-center gap-1.5">
                                  <span>{flagEmoji(c.country)}</span>
                                  <span className="text-muted-foreground">{c.country}</span>
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-bold text-foreground">{c.users.toLocaleString()}</td>
                              <td className="py-2.5 text-right text-muted-foreground">{c.sessions.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Timezones table */}
                  {geoView === "timezones" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/8">
                            <th className="text-left pb-2 text-muted-foreground font-semibold">#</th>
                            <th className="text-left pb-2 text-muted-foreground font-semibold">Timezone</th>
                            <th className="text-right pb-2 text-muted-foreground font-semibold">Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTimezones.length === 0 && (
                            <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No timezone data — set during signup</td></tr>
                          )}
                          {filteredTimezones.map((t, i) => (
                            <tr key={t.timezone} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                              <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                              <td className="py-2.5 font-medium text-foreground font-mono">{t.timezone}</td>
                              <td className="py-2.5 text-right font-bold text-foreground">{t.users.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Growth table */}
                  {geoView === "growth" && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-muted-foreground">New users signed up in the last 7 days, grouped by country.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/8">
                              <th className="text-left pb-2 text-muted-foreground font-semibold">#</th>
                              <th className="text-left pb-2 text-muted-foreground font-semibold">Country</th>
                              <th className="text-right pb-2 text-muted-foreground font-semibold">New Users (7d)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGrowth.length === 0 && (
                              <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No new users in the last 7 days</td></tr>
                            )}
                            {filteredGrowth.map((g, i) => (
                              <tr key={g.country} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                                <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                                <td className="py-2.5">
                                  <span className="flex items-center gap-2">
                                    <span>{flagEmoji(g.country)}</span>
                                    <span className="font-medium text-foreground">{g.country}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className="font-bold text-[#10B981]">+{g.newUsers}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          })()}

          {/* ── Support Desk Tab ────────────────────────────────────────── */}
          {activeTab === "support" && (() => {
            const PRIORITY_META: Record<string, { color: string; label: string }> = {
              low:    { color: "#6B7280", label: "Low" },
              medium: { color: "#6366F1", label: "Medium" },
              high:   { color: "#F97316", label: "High" },
              urgent: { color: "#EF4444", label: "Urgent" },
            }
            const STATUS_META: Record<string, { color: string; label: string }> = {
              open:         { color: "#6366F1", label: "Open" },
              in_progress:  { color: "#F59E0B", label: "In Progress" },
              waiting_user: { color: "#8B5CF6", label: "Waiting User" },
              resolved:     { color: "#10B981", label: "Resolved" },
              closed:       { color: "#6B7280", label: "Closed" },
            }
            const CATEGORY_LABELS: Record<string, string> = {
              billing: "Billing", account: "Account", bug: "Bug",
              feature_request: "Feature", technical: "Technical", other: "Other",
            }

            const filteredTickets = supportTickets.filter(t => {
              const q = supportSearch.toLowerCase()
              return !q || t.subject.toLowerCase().includes(q) || (t.userEmail ?? "").toLowerCase().includes(q)
            })

            return (
              <div className="space-y-5">
                {/* Metrics row */}
                {supportMetrics && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Open",     value: supportMetrics.open,     color: "#6366F1", icon: AlertCircle },
                      { label: "Urgent",   value: supportMetrics.urgent,   color: "#EF4444", icon: Flame },
                      { label: "In Progress", value: (supportMetrics as unknown as Record<string, number>).in_progress ?? 0, color: "#F59E0B", icon: Clock },
                      { label: "Resolved", value: supportMetrics.resolved, color: "#10B981", icon: CheckCircle2 },
                      { label: "Total",    value: supportMetrics.total,    color: "#6B7280", icon: FileText },
                    ].map(({ label, value, color, icon: Icon }) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color }} />
                          </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: "60vh" }}>
                  {/* Ticket list */}
                  <div className="flex-1 rounded-2xl border border-white/8 bg-white/2 flex flex-col overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-white/8 space-y-3">
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <input
                          type="text" placeholder="Search tickets..."
                          value={supportSearch} onChange={e => setSupportSearch(e.target.value)}
                          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select value={supportStatusFilter} onChange={e => { setSupportStatusFilter(e.target.value); loadSupport() }}
                          className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-foreground">
                          <option value="all">All Status</option>
                          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={supportPriorityFilter} onChange={e => { setSupportPriorityFilter(e.target.value); loadSupport() }}
                          className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-foreground">
                          <option value="all">All Priority</option>
                          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={supportCategoryFilter} onChange={e => { setSupportCategoryFilter(e.target.value); loadSupport() }}
                          className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-foreground">
                          <option value="all">All Category</option>
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Ticket rows */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-sm">No tickets found</p>
                        </div>
                      ) : filteredTickets.map(ticket => {
                        const sm = STATUS_META[ticket.status] ?? STATUS_META.open
                        const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META.medium
                        const isSelected = selectedTicket?.ticket?.id === ticket.id
                        return (
                          <button key={ticket.id} onClick={() => loadTicketDetail(ticket.id)}
                            className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-colors ${isSelected ? "bg-white/5" : ""}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{ticket.subject}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{ticket.userEmail ?? ticket.userName ?? "Unknown"}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                  style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}30` }}>
                                  {sm.label}
                                </span>
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                  style={{ background: `${pm.color}15`, color: pm.color, border: `1px solid ${pm.color}30` }}>
                                  {pm.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                              <span className="text-[9px] text-muted-foreground/40">{timeAgo(ticket.updatedAt)}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Ticket Detail */}
                  <div className="flex-1 lg:max-w-xl rounded-2xl border border-white/8 bg-white/2 flex flex-col overflow-hidden">
                    {!selectedTicket ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm">Select a ticket to view details</p>
                      </div>
                    ) : loadingTicket ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {/* Ticket header */}
                        <div className="p-4 border-b border-white/8 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-foreground">{selectedTicket.ticket.subject}</h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {selectedTicket.owner?.email ?? "Unknown"} · {new Date(selectedTicket.ticket.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button onClick={() => { setSelectedTicket(null); setTicketMessages([]) }}
                              className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {/* Controls */}
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={selectedTicket.ticket.status}
                              onChange={e => handleUpdateTicket({ status: e.target.value })}
                              disabled={updatingTicket}
                              className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-foreground disabled:opacity-50">
                              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select
                              value={selectedTicket.ticket.priority}
                              onChange={e => handleUpdateTicket({ priority: e.target.value })}
                              disabled={updatingTicket}
                              className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-foreground disabled:opacity-50">
                              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <span className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-medium bg-white/5 border border-white/10 text-muted-foreground">
                              {CATEGORY_LABELS[selectedTicket.ticket.category] ?? selectedTicket.ticket.category}
                            </span>
                          </div>
                          {selectedTicket.assignedAdmin && (
                            <p className="text-[10px] text-muted-foreground">
                              Assigned: <span className="text-foreground">{selectedTicket.assignedAdmin.name}</span>
                            </p>
                          )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {ticketMessages.map(msg => {
                            const isAdmin = msg.senderType === "admin"
                            return (
                              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-xs ${
                                  isAdmin
                                    ? "bg-red-500/10 border border-red-500/20 text-foreground"
                                    : "bg-white/5 border border-white/10 text-foreground"
                                }`}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isAdmin ? "text-red-400" : "text-primary"}`}>
                                      {isAdmin ? "Admin" : (msg.senderName ?? "User")}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/50">{timeAgo(msg.createdAt)}</span>
                                  </div>
                                  <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                </div>
                              </div>
                            )
                          })}
                          {ticketMessages.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-8">No messages yet</div>
                          )}
                        </div>

                        {/* Reply box */}
                        {selectedTicket.ticket.status !== "closed" && (
                          <div className="p-4 border-t border-white/8">
                            <div className="flex gap-2">
                              <textarea
                                value={supportReply}
                                onChange={e => setSupportReply(e.target.value)}
                                placeholder="Type your reply..."
                                rows={2}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg text-xs p-2.5 text-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-red-500/40 transition-colors"
                              />
                              <button
                                onClick={handleSupportReply}
                                disabled={sendingReply || !supportReply.trim()}
                                className="px-3 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-40 shrink-0">
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {activeTab === "impersonation-logs" && (() => {
            const fmtDuration = (ms: number | null) => {
              if (ms === null) return "—"
              const s = Math.floor(ms / 1000)
              if (s < 60) return `${s}s`
              const m = Math.floor(s / 60)
              if (m < 60) return `${m}m ${s % 60}s`
              return `${Math.floor(m / 60)}h ${m % 60}m`
            }
            const fmtAvgDuration = (ms: number | null) => {
              if (!ms) return "—"
              return fmtDuration(ms)
            }
            const filtered = impLogs.filter(l => {
              const qa = impAdminFilter.toLowerCase()
              const qt = impTargetFilter.toLowerCase()
              return (
                (!qa || (l.adminEmail ?? "").toLowerCase().includes(qa) || (l.adminName ?? "").toLowerCase().includes(qa)) &&
                (!qt || (l.targetEmail ?? "").toLowerCase().includes(qt) || (l.targetName ?? "").toLowerCase().includes(qt))
              )
            })

            const STAT_CARDS = [
              { label: "Total Sessions",    value: impLogsStats?.totalSessions  ?? 0, color: "#6366F1", icon: ClipboardList },
              { label: "Active Now",        value: impLogsStats?.activeSessions ?? 0, color: "#F59E0B", icon: Eye },
              { label: "Unique Admins",     value: impLogsStats?.uniqueAdmins   ?? 0, color: "#10B981", icon: Shield },
              { label: "Users Impersonated",value: impLogsStats?.uniqueTargets  ?? 0, color: "#8B5CF6", icon: Users },
              { label: "Avg Duration",      value: fmtAvgDuration(impLogsStats?.avgDurationMs ?? null), color: "#6B7280", icon: Clock, isString: true },
            ] as const

            return (
              <div className="space-y-5">
                {/* Overview cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {STAT_CARDS.map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Admin</label>
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
                        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input type="text" value={impAdminFilter} onChange={e => setImpAdminFilter(e.target.value)}
                          placeholder="Filter by admin…" className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none flex-1 min-w-0" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Target User</label>
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
                        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input type="text" value={impTargetFilter} onChange={e => setImpTargetFilter(e.target.value)}
                          placeholder="Filter by user…" className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none flex-1 min-w-0" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Action</label>
                      <select value={impActionFilter} onChange={e => setImpActionFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none">
                        <option value="all">All</option>
                        <option value="start">Start</option>
                        <option value="stop">Stop</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">From</label>
                      <input type="date" value={impDateFrom} onChange={e => setImpDateFrom(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">To</label>
                      <input type="date" value={impDateTo} onChange={e => setImpDateTo(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none" />
                    </div>
                    <button onClick={() => { setImpLogsPage(1); loadImpersonationLogs(1) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all shrink-0">
                      <RefreshCw className={`h-3 w-3 ${impLogsLoading ? "animate-spin" : ""}`} /> Apply
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/8">
                          {["Admin", "Target User", "Action", "Reason", "Duration", "Time", "IP Hash"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {impLogsLoading && (
                          <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                          </td></tr>
                        )}
                        {!impLogsLoading && filtered.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">No impersonation sessions found</td></tr>
                        )}
                        {!impLogsLoading && filtered.map(log => {
                          const isExpanded = expandedImpLog === log.id
                          return (
                            <React.Fragment key={log.id}>
                              <tr
                                onClick={() => setExpandedImpLog(isExpanded ? null : log.id)}
                                className={`border-b border-white/5 cursor-pointer transition-colors ${
                                  log.isActive ? "bg-amber-500/5 hover:bg-amber-500/8" : "hover:bg-white/3"
                                } ${isExpanded ? "bg-white/5" : ""}`}>
                                <td className="px-4 py-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                                      <Shield className="h-3 w-3 text-red-400" />
                                    </div>
                                    <div>
                                      <p className="text-foreground truncate max-w-[140px]">{log.adminEmail ?? log.adminId.slice(0, 8)}</p>
                                      {log.adminName && <p className="text-muted-foreground text-[10px] truncate max-w-[140px]">{log.adminName}</p>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="text-foreground truncate max-w-[140px]">{log.targetEmail ?? log.targetUserId.slice(0, 8)}</p>
                                      {log.targetName && <p className="text-muted-foreground text-[10px] truncate max-w-[140px]">{log.targetName}</p>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {log.isActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />Active
                                    </span>
                                  ) : log.action === "start" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Start</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">Stop</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  <span className="truncate max-w-[180px] block">{log.reason ?? <span className="italic opacity-50">no reason</span>}</span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground font-mono">{fmtDuration(log.durationMs)}</td>
                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{timeAgo(log.startedAt)}</td>
                                <td className="px-4 py-3 font-mono text-muted-foreground/60 text-[10px]">{log.ipHashMasked ?? "—"}</td>
                              </tr>

                              {/* Detail drawer */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="px-0 py-0">
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-b border-amber-500/15 bg-amber-500/3">
                                        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                          {/* Left: Identities */}
                                          <div className="space-y-3">
                                            <p className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest mb-3">Session Identities</p>
                                            <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-1.5">
                                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Admin</p>
                                              <p className="text-sm font-bold text-foreground">{log.adminEmail ?? "—"}</p>
                                              {log.adminName && <p className="text-xs text-muted-foreground">{log.adminName}</p>}
                                              <p className="text-[9px] font-mono text-muted-foreground/50">{log.adminId}</p>
                                            </div>
                                            <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-1.5">
                                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Target User</p>
                                              <p className="text-sm font-bold text-foreground">{log.targetEmail ?? "—"}</p>
                                              {log.targetName && <p className="text-xs text-muted-foreground">{log.targetName}</p>}
                                              <p className="text-[9px] font-mono text-muted-foreground/50">{log.targetUserId}</p>
                                            </div>
                                          </div>

                                          {/* Right: Timeline + metadata */}
                                          <div className="space-y-3">
                                            <p className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest mb-3">Session Timeline</p>
                                            <div className="relative pl-4">
                                              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-white/10" />
                                              <div className="space-y-4">
                                                <div className="flex items-start gap-3">
                                                  <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-background shrink-0 mt-0.5" style={{ marginLeft: "-5px" }} />
                                                  <div>
                                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Started</p>
                                                    <p className="text-xs text-foreground">{new Date(log.startedAt).toLocaleString()}</p>
                                                  </div>
                                                </div>
                                                {log.endedAt ? (
                                                  <div className="flex items-start gap-3">
                                                    <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-background shrink-0 mt-0.5" style={{ marginLeft: "-5px" }} />
                                                    <div>
                                                      <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Ended</p>
                                                      <p className="text-xs text-foreground">{new Date(log.endedAt).toLocaleString()}</p>
                                                      <p className="text-[10px] text-muted-foreground mt-0.5">Duration: <span className="font-mono text-amber-400">{fmtDuration(log.durationMs)}</span></p>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-start gap-3">
                                                    <div className="h-3 w-3 rounded-full bg-amber-500 border-2 border-background shrink-0 mt-0.5 animate-pulse" style={{ marginLeft: "-5px" }} />
                                                    <div>
                                                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Active</p>
                                                      <p className="text-xs text-muted-foreground">Session still in progress</p>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Reason</p>
                                                <p className="text-xs text-foreground">{log.reason ?? <span className="italic text-muted-foreground/50">not provided</span>}</p>
                                              </div>
                                              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">IP Hash</p>
                                                <p className="text-[10px] font-mono text-muted-foreground/70">{log.ipHash ? log.ipHash.slice(0, 16) + "…" : "—"}</p>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {impLogsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
                      <p className="text-[10px] text-muted-foreground">Page {impLogsPage} of {impLogsTotalPages}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { const p = Math.max(1, impLogsPage - 1); setImpLogsPage(p); loadImpersonationLogs(p) }}
                          disabled={impLogsPage <= 1}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
                          ←
                        </button>
                        <button
                          onClick={() => { const p = Math.min(impLogsTotalPages, impLogsPage + 1); setImpLogsPage(p); loadImpersonationLogs(p) }}
                          disabled={impLogsPage >= impLogsTotalPages}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
                          →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ── CRM Intelligence Tab ───────────────────────────────────── */}
          {activeTab === "crm" && (() => {
            const CRM_LIFECYCLE_META: Record<CrmLifecycle, { label: string; color: string; bg: string; border: string }> = {
              new:        { label: "New",        color: "#6366F1", bg: "bg-indigo-500/10",  border: "border-indigo-500/20" },
              activated:  { label: "Activated",  color: "#3B82F6", bg: "bg-blue-500/10",   border: "border-blue-500/20" },
              engaged:    { label: "Engaged",    color: "#10B981", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              power_user: { label: "Power User", color: "#D4AF37", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
              at_risk:    { label: "At Risk",    color: "#F59E0B", bg: "bg-amber-500/10",  border: "border-amber-500/20" },
              churned:    { label: "Churned",    color: "#EF4444", bg: "bg-red-500/10",    border: "border-red-500/20" },
            }

            const scoreColor = (v: number, invert = false) => {
              const high = invert ? v >= 60 : v >= 70
              const mid  = invert ? v >= 30 : v >= 40
              return high ? (invert ? "text-red-400" : "text-emerald-400")
                   : mid  ? "text-amber-400"
                   : (invert ? "text-emerald-400" : "text-red-400")
            }

            const ScoreBar = ({ value, invert = false }: { value: number; invert?: boolean }) => {
              const color = invert
                ? value >= 60 ? "bg-red-500" : value >= 30 ? "bg-amber-500" : "bg-emerald-500"
                : value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500"
              return (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
                  </div>
                  <span className={`text-[10px] font-black tabular-nums w-6 ${scoreColor(value, invert)}`}>{value}</span>
                </div>
              )
            }

            const timeAgo = (d: string | null) => {
              if (!d) return "never"
              const diff = Date.now() - new Date(d).getTime()
              const days = Math.floor(diff / 86400000)
              if (days === 0) return "today"
              if (days === 1) return "yesterday"
              if (days < 30) return `${days}d ago`
              return `${Math.floor(days / 30)}mo ago`
            }

            const sorted = [...crmUsers].sort((a, b) => {
              const av = crmSort === "lastSeenAt"
                ? (a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0)
                : (a.crm?.[crmSort] ?? 0)
              const bv = crmSort === "lastSeenAt"
                ? (b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0)
                : (b.crm?.[crmSort] ?? 0)
              return crmSortDir === "desc" ? bv - av : av - bv
            })

            const SortBtn = ({ field, label }: { field: typeof crmSort; label: string }) => (
              <button onClick={() => {
                if (crmSort === field) setCrmSortDir(d => d === "desc" ? "asc" : "desc")
                else { setCrmSort(field); setCrmSortDir("desc") }
              }} className="flex items-center gap-1 text-[10px] font-black text-muted-foreground hover:text-foreground transition-colors">
                {label}
                {crmSort === field ? (crmSortDir === "desc" ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />) : null}
              </button>
            )

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-foreground">CRM Intelligence</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Behavioral scoring · Lifecycle tracking · Churn signals</p>
                  </div>
                  <button
                    onClick={async () => {
                      setCrmRecalculating(true)
                      try {
                        await fetch("/api/admin/crm/recalculate", { method: "POST", credentials: "include" })
                        await loadCrm()
                      } catch (_) {}
                      setCrmRecalculating(false)
                    }}
                    disabled={crmRecalculating}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/15 transition-all disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${crmRecalculating ? "animate-spin" : ""}`} />
                    {crmRecalculating ? "Recalculating…" : "Recalculate Scores"}
                  </button>
                </div>

                {/* Overview Cards */}
                {crmOverview && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {([
                      { label: "Total",       value: crmOverview.totalUsers,    icon: Users,        color: "#6366F1" },
                      { label: "New",         value: crmOverview.newUsers,      icon: Circle,       color: "#6366F1" },
                      { label: "Activated",   value: crmOverview.activatedUsers,icon: CheckCircle2, color: "#3B82F6" },
                      { label: "Engaged",     value: crmOverview.engagedUsers,  icon: Activity,     color: "#10B981" },
                      { label: "Power User",  value: crmOverview.powerUsers,    icon: Flame,        color: "#D4AF37" },
                      { label: "At Risk",     value: crmOverview.atRiskUsers,   icon: AlertCircle,  color: "#F59E0B" },
                      { label: "Churned",     value: crmOverview.churnedUsers,  icon: TrendingDown, color: "#EF4444" },
                    ] as Array<{ label: string; value: number; icon: React.ElementType; color: string }>).map(({ label, value, icon: Icon, color }) => (
                      <div key={label}
                        onClick={() => {
                          const map: Record<string, CrmLifecycle | "all"> = {
                            Total: "all", New: "new", Activated: "activated", Engaged: "engaged",
                            "Power User": "power_user", "At Risk": "at_risk", Churned: "churned"
                          }
                          setCrmLifecycleFilter(map[label] ?? "all")
                        }}
                        className={`rounded-xl border p-3 cursor-pointer transition-all hover:bg-white/4 ${
                          crmLifecycleFilter === (label === "Total" ? "all" : label.toLowerCase().replace(" ", "_"))
                            ? "bg-white/5 border-white/15" : "bg-white/2 border-white/8"
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
                          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: `${color}18` }}>
                            <Icon className="h-3 w-3" style={{ color }} />
                          </div>
                        </div>
                        <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white/3 border border-white/8 rounded-lg px-3 h-8 flex-1 min-w-[180px]">
                    <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                    <input value={crmSearch} onChange={e => setCrmSearch(e.target.value)}
                      placeholder="Search users…"
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none" />
                  </div>
                  <select value={crmLifecycleFilter}
                    onChange={e => setCrmLifecycleFilter(e.target.value as CrmLifecycle | "all")}
                    className="h-8 px-2 rounded-lg border border-white/8 bg-white/3 text-xs text-foreground outline-none">
                    <option value="all">All Stages</option>
                    {(Object.keys(CRM_LIFECYCLE_META) as CrmLifecycle[]).map(k => (
                      <option key={k} value={k}>{CRM_LIFECYCLE_META[k].label}</option>
                    ))}
                  </select>
                  <select value={crmPlanFilter}
                    onChange={e => setCrmPlanFilter(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-white/8 bg-white/3 text-xs text-foreground outline-none">
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="startup">Startup</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <button onClick={loadCrm} disabled={crmLoading}
                    className="h-8 px-3 rounded-lg border border-white/8 bg-white/3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className={`h-3 w-3 ${crmLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* CRM Table */}
                <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/8 bg-white/2">
                          <th className="text-left px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest">User</th>
                          <th className="text-left px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Plan</th>
                          <th className="text-left px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Lifecycle</th>
                          <th className="px-4 py-3">
                            <SortBtn field="engagementScore" label="Engagement" />
                          </th>
                          <th className="px-4 py-3">
                            <SortBtn field="valueScore" label="Value" />
                          </th>
                          <th className="px-4 py-3">
                            <SortBtn field="churnRiskScore" label="Churn Risk" />
                          </th>
                          <th className="px-4 py-3">
                            <SortBtn field="lastSeenAt" label="Last Active" />
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {crmLoading ? (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
                        ) : sorted.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                            No users found. Click <strong>Recalculate Scores</strong> to generate CRM profiles.
                          </td></tr>
                        ) : sorted.map(u => {
                          const meta = u.crm ? CRM_LIFECYCLE_META[u.crm.lifecycleStage as CrmLifecycle] : null
                          return (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-semibold text-foreground truncate max-w-[160px]">{u.name}</p>
                                  <p className="text-muted-foreground truncate max-w-[160px]">{u.email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  u.plan === "enterprise" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                                  u.plan === "startup"    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                                  u.plan === "pro"        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" :
                                  "bg-white/8 text-muted-foreground border border-white/10"
                                }`}>{u.plan}</span>
                              </td>
                              <td className="px-4 py-3">
                                {meta ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${meta.bg} ${meta.border} border`} style={{ color: meta.color }}>
                                    {meta.label}
                                  </span>
                                ) : <span className="text-muted-foreground/40 text-[9px]">unscored</span>}
                              </td>
                              <td className="px-4 py-3 w-28">
                                {u.crm ? <ScoreBar value={u.crm.engagementScore} /> : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              <td className="px-4 py-3 w-28">
                                {u.crm ? <ScoreBar value={u.crm.valueScore} /> : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              <td className="px-4 py-3 w-28">
                                {u.crm ? <ScoreBar value={u.crm.churnRiskScore} invert /> : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {timeAgo(u.lastSeenAt)}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={async () => {
                                    setCrmDrawerOpen(true)
                                    setSelectedCrmUser(null)
                                    await loadCrmUserDetail(u.id)
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all">
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {sorted.length > 0 && (
                    <div className="px-4 py-2 border-t border-white/8">
                      <p className="text-[10px] text-muted-foreground">{sorted.length} users</p>
                    </div>
                  )}
                </div>

                {/* User Detail Drawer */}
                <AnimatePresence>
                  {crmDrawerOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
                      onClick={e => { if (e.target === e.currentTarget) setCrmDrawerOpen(false) }}>
                      <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="h-full w-full max-w-xl bg-[#0a0a0a] border-l border-white/8 overflow-y-auto">

                        {loadingCrmDetail ? (
                          <div className="flex items-center justify-center h-full">
                            <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                          </div>
                        ) : selectedCrmUser ? (
                          <div className="p-6 space-y-5">
                            {/* Drawer Header */}
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-sm font-black text-foreground">{selectedCrmUser.user.name}</h3>
                                <p className="text-xs text-muted-foreground">{selectedCrmUser.user.email}</p>
                                {selectedCrmUser.user.country && (
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{selectedCrmUser.user.city ? `${selectedCrmUser.user.city}, ` : ""}{selectedCrmUser.user.country}</p>
                                )}
                              </div>
                              <button onClick={() => setCrmDrawerOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Plan + Joined */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Plan</p>
                                <p className="text-sm font-black text-foreground capitalize">{selectedCrmUser.subscription?.plan ?? "free"}</p>
                              </div>
                              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Member Since</p>
                                <p className="text-sm font-black text-foreground">{new Date(selectedCrmUser.user.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>

                            {/* Scores */}
                            <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Behavioral Scores</p>
                              {selectedCrmUser.crm ? (
                                <>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[10px] font-bold text-muted-foreground">Engagement</span>
                                    </div>
                                    <ScoreBar value={selectedCrmUser.crm.engagementScore} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">Value</span>
                                    <ScoreBar value={selectedCrmUser.crm.valueScore} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">Activity</span>
                                    <ScoreBar value={selectedCrmUser.crm.activityScore} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">Churn Risk</span>
                                    <ScoreBar value={selectedCrmUser.crm.churnRiskScore} invert />
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Not yet scored — run Recalculate</p>
                              )}
                            </div>

                            {/* Usage Stats */}
                            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Usage Breakdown</p>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: "BI",         value: selectedCrmUser.stats.biGenerations },
                                  { label: "Website",    value: selectedCrmUser.stats.websiteGenerations },
                                  { label: "Chatbot",    value: selectedCrmUser.stats.chatbotGenerations },
                                  { label: "Automation", value: selectedCrmUser.stats.automationGenerations },
                                  { label: "Marcus",     value: selectedCrmUser.stats.marcusMessages },
                                  { label: "Projects",   value: selectedCrmUser.stats.projectCount },
                                  { label: "Sessions",   value: selectedCrmUser.stats.sessionCount },
                                  { label: "Tickets",    value: selectedCrmUser.stats.supportTickets },
                                  { label: "Total Gen",  value: selectedCrmUser.stats.totalGenerations },
                                ].map(({ label, value }) => (
                                  <div key={label} className="rounded-lg bg-white/4 p-2 text-center">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                                    <p className="text-sm font-black text-foreground tabular-nums">{value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* AI Insights */}
                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">AI Insights</p>
                              <div className="space-y-2">
                                {selectedCrmUser.insights.map((insight, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                                    <p className="text-xs text-foreground/80">{insight}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Activity Timeline */}
                            {selectedCrmUser.timeline.length > 0 && (
                              <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Recent Activity</p>
                                <div className="relative pl-4 space-y-3 max-h-48 overflow-y-auto">
                                  <div className="absolute left-1.5 top-0 bottom-0 w-px bg-white/10" />
                                  {selectedCrmUser.timeline.slice(0, 15).map((ev, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <div className="h-2 w-2 rounded-full bg-indigo-500/60 border border-indigo-500/40 shrink-0 mt-0.5" style={{ marginLeft: "-3px" }} />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-mono text-muted-foreground/70 truncate block">{ev.type}</span>
                                        <span className="text-[9px] text-muted-foreground/40">{new Date(ev.createdAt).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Edit: Lifecycle */}
                            <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Edit Lifecycle Stage</p>
                              <div className="flex flex-wrap gap-2">
                                {(Object.keys(CRM_LIFECYCLE_META) as CrmLifecycle[]).map(k => (
                                  <button key={k}
                                    onClick={() => setCrmEditLifecycle(k)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                      crmEditLifecycle === k
                                        ? `${CRM_LIFECYCLE_META[k].bg} ${CRM_LIFECYCLE_META[k].border}`
                                        : "bg-white/4 border-white/10 text-muted-foreground hover:text-foreground"
                                    }`}
                                    style={crmEditLifecycle === k ? { color: CRM_LIFECYCLE_META[k].color } : {}}>
                                    {CRM_LIFECYCLE_META[k].label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Edit: Tags */}
                            <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Tags</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {crmEditTags.map(tag => (
                                  <span key={tag}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {tag}
                                    <button onClick={() => setCrmEditTags(t => t.filter(x => x !== tag))}
                                      className="hover:text-red-400 transition-colors"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input value={crmTagInput} onChange={e => setCrmTagInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && crmTagInput.trim()) {
                                      const tag = crmTagInput.trim().toLowerCase().replace(/\s+/g, "-")
                                      if (!crmEditTags.includes(tag)) setCrmEditTags(t => [...t, tag])
                                      setCrmTagInput("")
                                    }
                                  }}
                                  placeholder="Add tag (Enter)"
                                  className="flex-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                                <button onClick={() => {
                                  const suggested = ["early-adopter", "high-usage", "high-potential", "inactive", "vip", "churning"]
                                  const unused = suggested.filter(t => !crmEditTags.includes(t))
                                  if (unused[0]) setCrmEditTags(t => [...t, unused[0]])
                                }} className="px-2 rounded-lg border border-white/10 bg-white/4 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                  Suggest
                                </button>
                              </div>
                            </div>

                            {/* Edit: Notes */}
                            <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Admin Notes</p>
                              <textarea value={crmEditNotes} onChange={e => setCrmEditNotes(e.target.value)}
                                rows={4} placeholder="Internal notes about this user…"
                                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none resize-none" />
                            </div>

                            {/* Save */}
                            <button onClick={saveCrmProfile} disabled={crmSaving}
                              className="w-full py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-black hover:bg-indigo-500/20 transition-all disabled:opacity-50">
                              {crmSaving ? "Saving…" : "Save Changes"}
                            </button>
                          </div>
                        ) : null}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })()}

          {/* ── Acquisition Intelligence Tab ──────────────────────────────── */}
          {activeTab === "acquisition" && (() => {
            const STATUS_COLORS: Record<string, string> = {
              waitlisted: "#6B7280", invited: "#F59E0B", signed_up: "#6366F1", converted: "#10B981"
            }
            const STATUS_LABELS: Record<string, string> = {
              waitlisted: "Waitlisted", invited: "Invited", signed_up: "Signed Up", converted: "Converted"
            }
            const SOURCE_COLORS: Record<string, string> = {
              linkedin: "#0A66C2", twitter: "#1DA1F2", "twitter/x": "#1DA1F2", x: "#1DA1F2",
              referral: "#8B5CF6", direct: "#6B7280", "product hunt": "#DA552F", producthunt: "#DA552F",
              unknown: "#374151"
            }
            const sourceColor = (s: string) => SOURCE_COLORS[s.toLowerCase()] ?? "#6366F1"

            const sortedUsers = [...acqUsers].sort((a, b) => {
              const dir = acqSortDir === "desc" ? -1 : 1
              if (acqSort === "conversionScore") return dir * (a.conversionScore - b.conversionScore)
              return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            })

            const maxSource = acqSources.reduce((m, s) => Math.max(m, s.total), 0)

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-sm font-black text-foreground flex-1">Acquisition Intelligence</h2>
                  <button onClick={handleAcqSync} disabled={acqSyncing || acqLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
                    <RefreshCw className={`h-3 w-3 ${acqSyncing ? "animate-spin" : ""}`} />
                    {acqSyncing ? "Syncing…" : "Sync"}
                  </button>
                  <a href="/api/admin/acquisition/export" target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all">
                    <Download className="h-3 w-3" /> Export CSV
                  </a>
                </div>

                {/* Sub-nav */}
                <div className="flex gap-1 flex-wrap">
                  {(["overview", "funnel", "sources", "referrals", "users"] as const).map(s => (
                    <button key={s} onClick={() => setAcqSection(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize ${acqSection === s ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {s === "users" ? "Waitlist Table" : s === "funnel" ? "Funnel" : s === "sources" ? "Sources" : s === "referrals" ? "Referrals" : "Overview"}
                    </button>
                  ))}
                </div>

                {acqLoading && (
                  <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 text-muted-foreground animate-spin" />
                    <p className="text-xs text-muted-foreground">Loading acquisition data…</p>
                  </div>
                )}

                {!acqLoading && acqSection === "overview" && (
                  <div className="space-y-4">
                    {/* Overview cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Total", value: acqOverview?.total ?? 0, color: "#6366F1" },
                        { label: "Invited", value: acqOverview?.invited ?? 0, color: "#F59E0B" },
                        { label: "Signed Up", value: acqOverview?.signedUp ?? 0, color: "#818CF8" },
                        { label: "Converted", value: acqOverview?.converted ?? 0, color: "#10B981" },
                      ].map(c => (
                        <div key={c.label} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{c.label}</p>
                          <p className="text-2xl font-black" style={{ color: c.color }}>{c.value.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Conversion Rate</p>
                        <p className="text-3xl font-black text-emerald-400">{acqOverview?.conversionRate ?? 0}%</p>
                        <p className="text-[10px] text-muted-foreground mt-1">waitlist → paid</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Signup Rate</p>
                        <p className="text-3xl font-black text-indigo-400">{acqOverview?.signupRate ?? 0}%</p>
                        <p className="text-[10px] text-muted-foreground mt-1">waitlist → account</p>
                      </div>
                    </div>
                  </div>
                )}

                {!acqLoading && acqSection === "funnel" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5">
                        <p className="text-xs font-black text-foreground">Acquisition Funnel</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Drop-off at each stage</p>
                      </div>
                      <div className="p-5 space-y-4">
                        {acqFunnel.map((stage, i) => (
                          <div key={stage.stage}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-foreground">{stage.stage}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-foreground">{stage.count.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">{stage.pct}%</span>
                              </div>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${stage.pct}%` }} transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                                className="h-full rounded-full"
                                style={{ background: i === 0 ? "#6366F1" : i === 1 ? "#8B5CF6" : i === 2 ? "#818CF8" : "#10B981" }} />
                            </div>
                            {stage.dropOff > 0 && i < acqFunnel.length - 1 && (
                              <p className="text-[9px] text-red-400/70 mt-1">↓ {stage.dropOff}% drop-off to next stage</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!acqLoading && acqSection === "sources" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                      <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        <span className="col-span-2">Source</span><span>Signups</span><span>Converted</span>
                      </div>
                      {acqSources.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-10">No source data yet</p>
                      ) : acqSources.map((s, i) => (
                        <motion.div key={s.source} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          className="px-5 py-3.5 border-b border-white/4 last:border-0">
                          <div className="grid grid-cols-4 gap-4 items-center mb-2">
                            <div className="col-span-2 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: sourceColor(s.source) }} />
                              <span className="text-xs font-bold text-foreground capitalize">{s.source}</span>
                              <span className="text-[10px] text-muted-foreground">({s.total})</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-400">{s.signedUp}</span>
                            <span className="text-xs font-bold text-emerald-400">{s.converted}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${maxSource > 0 ? (s.total / maxSource) * 100 : 0}%` }} transition={{ delay: i * 0.05, duration: 0.5 }}
                              className="h-full rounded-full" style={{ background: sourceColor(s.source) }} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {!acqLoading && acqSection === "referrals" && (
                  <div className="space-y-3">
                    {acqReferrers.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center">
                        <p className="text-xs text-muted-foreground">No referral data yet</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <span className="col-span-2">Referrer</span><span>Referrals</span><span>Converted</span>
                        </div>
                        {acqReferrers.map((r, i) => (
                          <motion.div key={r.email} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            className="grid grid-cols-4 gap-4 items-center px-5 py-3.5 border-b border-white/4 last:border-0">
                            <div className="col-span-2">
                              <p className="text-xs font-bold text-foreground truncate">{r.email}</p>
                              <p className="text-[10px] text-muted-foreground">{r.signupCount} signed up</p>
                            </div>
                            <span className="text-xs font-black text-purple-400">{r.referralCount}</span>
                            <span className="text-xs font-black text-emerald-400">{r.conversionCount}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!acqLoading && acqSection === "users" && (
                  <div className="space-y-3">
                    {/* Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input value={acqSearch} onChange={e => setAcqSearch(e.target.value)}
                          placeholder="Search email or name…"
                          className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/20" />
                      </div>
                      <select value={acqStatusFilter} onChange={e => setAcqStatusFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none">
                        <option value="all">All Status</option>
                        <option value="waitlisted">Waitlisted</option>
                        <option value="invited">Invited</option>
                        <option value="signed_up">Signed Up</option>
                        <option value="converted">Converted</option>
                      </select>
                      <select value={acqSourceFilter} onChange={e => setAcqSourceFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none">
                        <option value="all">All Sources</option>
                        {[...new Set(acqUsers.map(u => u.source))].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={() => {
                        if (acqSort === "conversionScore") { setAcqSortDir(d => d === "desc" ? "asc" : "desc") }
                        else { setAcqSort("conversionScore"); setAcqSortDir("desc") }
                      }} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${acqSort === "conversionScore" ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 bg-white/3 text-muted-foreground"}`}>
                        Score {acqSort === "conversionScore" ? (acqSortDir === "desc" ? "↓" : "↑") : ""}
                      </button>
                      <button onClick={() => {
                        if (acqSort === "createdAt") { setAcqSortDir(d => d === "desc" ? "asc" : "desc") }
                        else { setAcqSort("createdAt"); setAcqSortDir("desc") }
                      }} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${acqSort === "createdAt" ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 bg-white/3 text-muted-foreground"}`}>
                        Date {acqSort === "createdAt" ? (acqSortDir === "desc" ? "↓" : "↑") : ""}
                      </button>
                      <button onClick={loadAcquisition} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all">
                        Apply
                      </button>
                    </div>

                    {sortedUsers.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center">
                        <UserCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-30" />
                        <p className="text-xs text-muted-foreground">No acquisition records yet — click Sync to import data</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                        <div className="grid grid-cols-7 gap-3 px-4 py-3 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <span className="col-span-2">Name / Email</span>
                          <span>Source</span>
                          <span>Status</span>
                          <span>Referral</span>
                          <span>Score</span>
                          <span>Joined</span>
                        </div>
                        {sortedUsers.map((u, i) => (
                          <motion.div key={u.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                            className="grid grid-cols-7 gap-3 items-center px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors group">
                            <div className="col-span-2 min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{u.name ?? "—"}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                              {u.company && <p className="text-[9px] text-muted-foreground/60 truncate">{u.company}</p>}
                            </div>
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold truncate">
                                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: sourceColor(u.source) }} />
                                <span className="capitalize truncate" style={{ color: sourceColor(u.source) }}>{u.source}</span>
                              </span>
                            </div>
                            <div>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black border"
                                style={{
                                  background: STATUS_COLORS[u.status] + "15",
                                  color: STATUS_COLORS[u.status],
                                  borderColor: STATUS_COLORS[u.status] + "30",
                                }}>
                                {STATUS_LABELS[u.status]}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {u.referredBy ? <span className="text-purple-400 truncate">{u.referredBy}</span> : "—"}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-[48px]">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${u.conversionScore}%`, background: u.conversionScore >= 80 ? "#10B981" : u.conversionScore >= 50 ? "#F59E0B" : "#6B7280" }} />
                              </div>
                              <span className="text-[10px] font-black" style={{ color: u.conversionScore >= 80 ? "#10B981" : u.conversionScore >= 50 ? "#F59E0B" : "#6B7280" }}>
                                {u.conversionScore}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-muted-foreground">{timeAgo(u.createdAt)}</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {u.status === "waitlisted" && (
                                  <button onClick={() => handleAcqInvite(u.id)} disabled={acqInviting === u.id}
                                    title="Send invite"
                                    className="p-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40">
                                    <Mail className="h-3 w-3" />
                                  </button>
                                )}
                                <button onClick={() => { setAcqEditUser(u); setAcqEditNotes(u.notes ?? ""); setAcqEditStatus(u.status); setAcqEditSource(u.source) }}
                                  className="p-1 rounded-lg bg-white/5 text-muted-foreground hover:text-foreground transition-all">
                                  <Edit className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Edit drawer */}
                <AnimatePresence>
                  {acqEditUser && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
                      onClick={e => { if (e.target === e.currentTarget) setAcqEditUser(null) }}>
                      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                        className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-foreground">Edit Profile</p>
                          <button onClick={() => setAcqEditUser(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                          <p className="text-xs font-bold text-foreground">{acqEditUser.name ?? acqEditUser.email}</p>
                          <p className="text-[10px] text-muted-foreground">{acqEditUser.email}</p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Status</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {(["waitlisted", "invited", "signed_up", "converted"] as const).map(s => (
                                <button key={s} onClick={() => setAcqEditStatus(s)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${acqEditStatus === s ? "border-white/20 bg-white/8 text-foreground" : "border-white/8 bg-white/3 text-muted-foreground"}`}>
                                  {STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Source</p>
                            <input value={acqEditSource} onChange={e => setAcqEditSource(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Notes</p>
                            <textarea value={acqEditNotes} onChange={e => setAcqEditNotes(e.target.value)} rows={3}
                              className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground resize-none focus:outline-none focus:border-white/20" />
                          </div>
                        </div>
                        <button onClick={handleAcqSave} disabled={acqSaving}
                          className="w-full py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-black hover:bg-indigo-500/20 transition-all disabled:opacity-50">
                          {acqSaving ? "Saving…" : "Save Changes"}
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })()}

          {/* ── Feature Flags Tab ──────────────────────────────────────── */}
          {activeTab === "feature-flags" && (
            <AdminFeatureFlags />
          )}

          {/* ── System Health Tab ───────────────────────────────────────── */}
          {activeTab === "system-health" && (
            <AdminSystemHealth />
          )}

          {/* ── AI Models Tab ───────────────────────────────────────────── */}
          {activeTab === "ai-models" && (
            <AdminAiModels />
          )}

          {/* ── Security Tab ────────────────────────────────────────────── */}
          {activeTab === "security" && (
            <AdminSecurity />
          )}

          {/* ── Incidents Tab ───────────────────────────────────────────── */}
          {activeTab === "incidents" && (
            <AdminIncidents />
          )}

          {/* ── Backups Tab ─────────────────────────────────────────────── */}
          {activeTab === "backups" && (
            <AdminBackups />
          )}

          {/* ── Module Pipeline Tab ─────────────────────────────────────── */}
          {activeTab === "pipeline" && (() => {
            const MODULE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
              bi_generated:           { label: "Business Intelligence", color: "#F59E0B", icon: BarChart3 },
              website_generated:      { label: "Website Generator",     color: "#8B5CF6", icon: Globe },
              chatbot_generated:      { label: "Chatbot Builder",       color: "#EC4899", icon: Bot },
              automation_created:     { label: "Automation Builder",    color: "#F97316", icon: Zap },
              orchestrator_generated: { label: "Orchestrator",          color: "#7C3AED", icon: Cpu },
            }
            const MODULE_KEYS = Object.keys(MODULE_META)

            const statMap: Record<string, PipelineModuleStat> = {}
            for (const s of (pipeline?.moduleStats ?? [])) statMap[s.type] = s

            const totalAll = MODULE_KEYS.reduce((acc, k) => acc + (statMap[k]?.total ?? 0), 0)

            const trendByDate: Record<string, Record<string, number>> = {}
            for (const row of (pipeline?.trend ?? [])) {
              if (!trendByDate[row.date]) trendByDate[row.date] = {}
              trendByDate[row.date][row.type] = row.count
            }
            const trendDates = Object.keys(trendByDate).sort().slice(-30)
            const trendMaxDay = Math.max(1, ...trendDates.map(d => MODULE_KEYS.reduce((s, k) => s + (trendByDate[d]?.[k] ?? 0), 0)))

            const pipelineLive = liveEvents.filter(e => MODULE_KEYS.includes(e.type))

            return (
              <div className="space-y-6">
                {/* ── Live indicator ── */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full border ${sseConnected ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground border-white/8 bg-white/3"}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
                    {sseConnected ? "Live" : "Disconnected"}
                  </div>
                  <span className="text-xs text-muted-foreground">Module generation pipeline across all 5 AI modules</span>
                  <button onClick={loadPipeline} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/3 border border-white/8 text-xs text-muted-foreground hover:text-foreground transition-all">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                {/* ── Module stat cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {MODULE_KEYS.map(key => {
                    const meta = MODULE_META[key]
                    const Icon = meta.icon
                    const stat = statMap[key]
                    const total = stat?.total ?? 0
                    const last24h = stat?.last24h ?? 0
                    const sharePct = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0
                    return (
                      <div key={key} className="rounded-2xl border border-white/6 bg-white/2 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}28` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-tight">{meta.label}</span>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-foreground tabular-nums">{total.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">all-time generations</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground/60">24h</span>
                            <span className="font-black" style={{ color: last24h > 0 ? meta.color : undefined }}>{last24h}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${sharePct}%` }} transition={{ duration: 0.6 }}
                              className="h-full rounded-full" style={{ background: meta.color }} />
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground/60">7d</span>
                            <span className="font-black text-muted-foreground">{stat?.last7d ?? 0}</span>
                          </div>
                        </div>
                        {stat?.last_at && (
                          <p className="text-[9px] text-muted-foreground/40 truncate">Last: {timeAgo(stat.last_at)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* ── 30-day trend ── */}
                {trendDates.length > 0 && (
                  <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-1">30-Day Activity</h3>
                    <p className="text-[10px] text-muted-foreground mb-4">Daily generations across all modules</p>
                    <div className="space-y-1">
                      {trendDates.map((date, i) => {
                        const dayTotal = MODULE_KEYS.reduce((s, k) => s + (trendByDate[date]?.[k] ?? 0), 0)
                        const barPct = (dayTotal / trendMaxDay) * 100
                        return (
                          <div key={date} className="flex items-center gap-3">
                            <span className="text-[9px] text-muted-foreground/50 w-14 shrink-0 font-mono">{date.slice(5)}</span>
                            <div className="flex-1 h-3 bg-white/4 rounded-full overflow-hidden flex">
                              {MODULE_KEYS.map(key => {
                                const cnt = trendByDate[date]?.[key] ?? 0
                                const pct = dayTotal > 0 ? (cnt / dayTotal) * barPct : 0
                                return pct > 0 ? (
                                  <motion.div key={key} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                    transition={{ delay: i * 0.01, duration: 0.4 }}
                                    style={{ background: MODULE_META[key].color, opacity: 0.75 }} className="h-full" />
                                ) : null
                              })}
                            </div>
                            <span className="text-[9px] font-black text-muted-foreground w-5 text-right tabular-nums">{dayTotal}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/5">
                      {MODULE_KEYS.map(key => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: MODULE_META[key].color }} />
                          <span className="text-[10px] text-muted-foreground">{MODULE_META[key].label.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Live pipeline events ── */}
                {pipelineLive.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</p>
                    {pipelineLive.slice(0, 5).map((e, i) => {
                      const meta = MODULE_META[e.type]
                      const Icon = meta?.icon ?? Layers
                      return (
                        <motion.div key={`live-pipeline-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5">
                          <div className="p-1 rounded-lg shrink-0" style={{ background: `${meta?.color ?? "#6B7280"}18` }}>
                            <Icon className="h-3 w-3" style={{ color: meta?.color ?? "#6B7280" }} />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono"
                            style={{ background: `${meta?.color ?? "#6B7280"}15`, color: meta?.color ?? "#6B7280", border: `1px solid ${meta?.color ?? "#6B7280"}30` }}>
                            {meta?.label ?? e.type}
                          </span>
                          <span className="text-xs text-muted-foreground truncate flex-1">{e.userName ?? e.userEmail ?? "anonymous"}</span>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeAgo(e.createdAt)}</span>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* ── Recent events feed ── */}
                <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-4">Recent Pipeline Events</h3>
                  {!pipeline ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : pipeline.recentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No module generations recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pipeline.recentEvents.map((e, i) => {
                        const meta = MODULE_META[e.type]
                        const Icon = meta?.icon ?? Layers
                        return (
                          <motion.div key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.008 }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/5 bg-white/1.5 hover:bg-white/3 transition-all">
                            <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${meta?.color ?? "#6B7280"}15`, border: `1px solid ${meta?.color ?? "#6B7280"}25` }}>
                              <Icon className="h-3 w-3" style={{ color: meta?.color ?? "#6B7280" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground truncate">{e.userName ?? e.userEmail ?? "anonymous"}</span>
                                {e.projectId && (
                                  <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0 hidden md:block">#{e.projectId.slice(0, 8)}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{meta?.label ?? e.type}</p>
                            </div>
                            {(e.city || e.country) && (
                              <span className="text-[10px] text-muted-foreground/50 hidden lg:flex items-center gap-0.5 shrink-0">
                                <MapPin className="h-2.5 w-2.5" />{[e.city, e.country].filter(Boolean).join(", ")}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/40 shrink-0">{timeAgo(e.createdAt)}</span>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
