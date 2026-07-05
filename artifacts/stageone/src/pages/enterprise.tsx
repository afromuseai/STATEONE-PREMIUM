import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Shield, Lock, FileText, Users, CheckCircle2, AlertTriangle,
  XCircle, Clock, Plus, RefreshCw, Trash2, Database, Key,
  Eye, Settings2, ChevronDown, ChevronUp, Sparkles
} from "lucide-react"

interface AuditLog {
  id: string
  action: string
  resource: string
  resourceId?: string
  changes: Record<string, unknown>
  ipAddress?: string
  severity: string
  outcome: string
  createdAt: string
}

interface Role {
  id: string
  name: string
  permissions: string[]
  createdAt: string
}

interface ComplianceData {
  complianceScore: number
  checks: { name: string; status: string; description: string }[]
  summary: { totalAuditLogs: number; criticalEvents: number; failures: number; rolesConfigured: number }
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  low: { color: "text-muted-foreground", bg: "bg-white/5 border-white/10" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
}

const ROLE_PRESETS = ["admin", "manager", "analyst", "viewer"]

const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400 bg-red-500/10 border-red-500/20",
  manager: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  analyst: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  viewer: "text-muted-foreground bg-white/5 border-white/10",
}

export default function EnterprisePage() {
  const [tab, setTab] = useState<"audit" | "rbac" | "compliance">("compliance")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRole, setNewRole] = useState("viewer")
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: auditData, isLoading: auditLoading } = useQuery<{ logs: AuditLog[]; stats: Record<string, unknown> }>({
    queryKey: ["audit-logs", filterSeverity],
    queryFn: () => fetch(`/api/enterprise/audit${filterSeverity !== "all" ? `?severity=${filterSeverity}` : ""}`, { credentials: "include" }).then(r => r.json()),
  })

  const { data: rolesData } = useQuery<{ roles: Role[]; availablePermissions: string[]; rolePresets: Record<string, string[]> }>({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/enterprise/roles", { credentials: "include" }).then(r => r.json()),
  })

  const { data: complianceData, isLoading: complianceLoading } = useQuery<ComplianceData>({
    queryKey: ["compliance"],
    queryFn: () => fetch("/api/enterprise/compliance", { credentials: "include" }).then(r => r.json()),
  })

  const seedAuditMutation = useMutation({
    mutationFn: () => fetch("/api/enterprise/audit/seed", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audit-logs"] }); qc.invalidateQueries({ queryKey: ["compliance"] }) },
  })

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => fetch("/api/enterprise/roles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); qc.invalidateQueries({ queryKey: ["compliance"] }); setShowNewRole(false) },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/enterprise/roles/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  })

  const logs = auditData?.logs ?? []
  const auditStats = auditData?.stats as { bySeverity?: Record<string, number>; failures?: number } ?? {}
  const roles = rolesData?.roles ?? []
  const rolePresets = rolesData?.rolePresets ?? {}

  return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-white/5 bg-[#0a0a0a] px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <h1 className="text-lg font-bold text-foreground">Enterprise Control</h1>
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">ENTERPRISE</span>
              </div>
              <p className="text-xs text-muted-foreground">Role-based access control, audit logging, and compliance management</p>
            </div>
            <div className="flex rounded-xl border border-white/8 overflow-hidden">
              {(["compliance", "audit", "rbac"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-white/4"}`}>
                  {t === "compliance" ? "Compliance" : t === "audit" ? `Audit Log (${logs.length})` : `RBAC (${roles.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "compliance" && (
            <div className="space-y-5">
              {complianceLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" /></div>
              ) : complianceData ? (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1 bg-white/2 border border-white/6 rounded-2xl p-6 flex flex-col items-center justify-center">
                      <div className={`text-5xl font-black mb-2 ${complianceData.complianceScore >= 80 ? "text-emerald-400" : complianceData.complianceScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                        {complianceData.complianceScore}%
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Compliance Score</p>
                    </div>
                    <div className="col-span-3 grid grid-cols-3 gap-3">
                      {[
                        { label: "Audit Logs", value: complianceData.summary.totalAuditLogs, icon: FileText, color: "text-blue-400" },
                        { label: "Critical Events", value: complianceData.summary.criticalEvents, icon: AlertTriangle, color: "text-red-400" },
                        { label: "Auth Failures", value: complianceData.summary.failures, icon: XCircle, color: "text-orange-400" },
                        { label: "Roles Configured", value: complianceData.summary.rolesConfigured, icon: Users, color: "text-violet-400" },
                        { label: "Checks Passing", value: complianceData.checks.filter(c => c.status === "pass").length, icon: CheckCircle2, color: "text-emerald-400" },
                        { label: "Checks Warning", value: complianceData.checks.filter(c => c.status === "warn").length, icon: AlertTriangle, color: "text-yellow-400" },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-white/2 border border-white/6 rounded-xl p-4 flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${color} shrink-0`} />
                          <div>
                            <p className="text-lg font-bold text-foreground">{value}</p>
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      Compliance Checks
                    </p>
                    <div className="space-y-2">
                      {complianceData.checks.map((check, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                          className={`flex items-center gap-4 border rounded-xl px-4 py-3 ${check.status === "pass" ? "bg-emerald-500/5 border-emerald-500/15" : "bg-yellow-500/5 border-yellow-500/15"}`}>
                          {check.status === "pass"
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            : <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{check.name}</p>
                            <p className="text-xs text-muted-foreground">{check.description}</p>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${check.status === "pass" ? "text-emerald-400" : "text-yellow-400"}`}>
                            {check.status === "pass" ? "Pass" : "Warning"}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {["all", "low", "medium", "high", "critical"].map(s => (
                    <button key={s} onClick={() => setFilterSeverity(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filterSeverity === s ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <button onClick={() => seedAuditMutation.mutate()} disabled={seedAuditMutation.isPending}
                  className="flex items-center gap-2 text-xs font-semibold bg-white/5 border border-white/10 text-muted-foreground rounded-xl px-3 py-1.5 hover:text-foreground transition-colors">
                  <Sparkles className="h-3.5 w-3.5" />
                  {seedAuditMutation.isPending ? "Seeding…" : "Seed Demo Logs"}
                </button>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" /></div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No audit logs</p>
                  <p className="text-xs text-muted-foreground/60 mb-4">Use the system and logs will appear here automatically</p>
                  <button onClick={() => seedAuditMutation.mutate()} disabled={seedAuditMutation.isPending}
                    className="text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors">
                    Seed Demo Logs
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((log, i) => {
                    const sev = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.low!
                    const isExpanded = expandedLog === log.id
                    return (
                      <motion.div key={log.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
                        className="border border-white/6 rounded-xl overflow-hidden">
                        <button onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                          className="w-full flex items-center gap-4 bg-white/2 px-4 py-3 hover:bg-white/3 transition-colors text-left">
                          <span className={`text-[9px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 shrink-0 ${sev.bg} ${sev.color}`}>
                            {log.severity}
                          </span>
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${log.outcome === "success" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                            {log.outcome === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{log.action}</p>
                            <p className="text-[10px] text-muted-foreground">{log.resource}{log.resourceId ? ` · ${log.resourceId}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                              className="overflow-hidden border-t border-white/5 bg-white/1">
                              <div className="px-4 py-3 grid grid-cols-3 gap-3 text-xs">
                                {[
                                  { label: "IP Address", value: log.ipAddress ?? "—" },
                                  { label: "Outcome", value: log.outcome },
                                  { label: "Timestamp", value: new Date(log.createdAt).toISOString() },
                                ].map(({ label, value }) => (
                                  <div key={label}>
                                    <p className="text-muted-foreground mb-0.5">{label}</p>
                                    <p className="text-foreground font-mono text-[10px]">{value}</p>
                                  </div>
                                ))}
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

          {tab === "rbac" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{roles.length} role{roles.length !== 1 ? "s" : ""} configured</p>
                <button onClick={() => setShowNewRole(true)} className="flex items-center gap-2 text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-3 py-1.5 hover:bg-primary/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Role
                </button>
              </div>

              <AnimatePresence>
                {showNewRole && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-sm font-bold text-foreground">Add Role</p>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Role Preset</label>
                      <div className="flex gap-2">
                        {ROLE_PRESETS.map(r => (
                          <button key={r} onClick={() => setNewRole(r)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${newRole === r ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {rolePresets[newRole] && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Permissions Included ({rolePresets[newRole]!.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rolePresets[newRole]!.map(p => (
                            <span key={p} className="text-[10px] bg-white/5 border border-white/8 text-muted-foreground rounded-lg px-2 py-0.5">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => createRoleMutation.mutate(newRole)} disabled={createRoleMutation.isPending}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50">
                        {createRoleMutation.isPending ? "Creating…" : "Create Role"}
                      </button>
                      <button onClick={() => setShowNewRole(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No roles configured</p>
                  <p className="text-xs text-muted-foreground/60">Add roles to control access to platform features</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role, i) => (
                    <motion.div key={role.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="bg-white/2 border border-white/6 rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <span className={`text-xs font-black uppercase tracking-wider border rounded-full px-2.5 py-0.5 ${ROLE_COLORS[role.name] ?? "text-muted-foreground bg-white/5 border-white/10"}`}>
                            {role.name}
                          </span>
                        </div>
                        <button onClick={() => deleteRoleMutation.mutate(role.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{role.permissions.length} permissions</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 6).map(p => (
                          <span key={p} className="text-[10px] bg-white/5 border border-white/8 text-muted-foreground rounded px-1.5 py-0.5">{p}</span>
                        ))}
                        {role.permissions.length > 6 && (
                          <span className="text-[10px] text-muted-foreground/60">+{role.permissions.length - 6} more</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  )
}
