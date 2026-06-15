import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Users, TrendingUp, Activity, BarChart3, RefreshCw } from "lucide-react"

interface DailyAU {
  date: string
  count: number
}

interface WeeklyCohort {
  week: string
  total: number
  retained7: number
  retained30: number
  d7Rate: number
  d30Rate: number
}

interface MonthlySignup {
  month: string
  count: number
}

interface RetentionData {
  dailyActiveUsers: DailyAU[]
  weeklyCohorts: WeeklyCohort[]
  monthlySignups: MonthlySignup[]
  planCounts: Record<string, number>
  conversionRate: number
  totalUsers: number
}

export function AdminRetentionPanel() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/retention", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load retention data")
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading retention data…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  const last30DAU = data.dailyActiveUsers.slice(-30)
  const maxDAU = Math.max(...last30DAU.map(d => d.count), 1)
  const avgDAU = last30DAU.length > 0
    ? Math.round(last30DAU.reduce((a, b) => a + b.count, 0) / last30DAU.length)
    : 0

  const maxSignups = Math.max(...data.monthlySignups.map(m => m.count), 1)
  const paidUsers = Object.entries(data.planCounts)
    .filter(([plan]) => plan !== "free")
    .reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Users", value: data.totalUsers.toLocaleString(), icon: Users, color: "#6366F1" },
          { label: "Avg DAU (30d)", value: avgDAU.toLocaleString(), icon: Activity, color: "#10B981" },
          { label: "Paid Conversion", value: `${data.conversionRate}%`, icon: TrendingUp, color: "#F59E0B" },
          { label: "Paid Users", value: paidUsers.toLocaleString(), icon: BarChart3, color: "#8B5CF6" },
        ].map(kpi => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
              </div>
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* DAU Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Daily Active Users (Last 30 Days)</h3>
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {last30DAU.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No activity data yet</p>
        ) : (
          <div className="flex items-end gap-1 h-32 w-full">
            {last30DAU.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-sm bg-primary/40 hover:bg-primary/70 transition-colors cursor-default"
                  style={{ height: `${Math.round((d.count / maxDAU) * 100)}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                  title={`${d.date}: ${d.count} users`}
                />
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex whitespace-nowrap rounded bg-card border border-border px-2 py-1 text-[10px] text-foreground shadow-lg z-10">
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{last30DAU[0]?.date ?? ""}</span>
          <span>{last30DAU[last30DAU.length - 1]?.date ?? ""}</span>
        </div>
      </div>

      {/* Cohort Retention Table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Cohort Retention</h3>
        {data.weeklyCohorts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Not enough data yet (need users with activity 7+ days after signup)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-muted-foreground font-medium">Signup Week</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">Users</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">D7 Retained</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">D7 Rate</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">D30 Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.weeklyCohorts.map((cohort, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 text-foreground font-mono">{cohort.week}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{cohort.total}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{cohort.retained7}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${cohort.d7Rate >= 40 ? "text-green-400" : cohort.d7Rate >= 20 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {cohort.d7Rate}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${cohort.d30Rate >= 25 ? "text-green-400" : cohort.d30Rate >= 10 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {cohort.d30Rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-muted-foreground">
              D7/D30 retention = users who had any event within 7/30 days of signup.
              Green ≥40% D7 / ≥25% D30 · Yellow ≥20% / ≥10% · Grey below.
            </p>
          </div>
        )}
      </div>

      {/* Monthly Signups Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Signups (Last 12 Months)</h3>
        {data.monthlySignups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No signup data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {data.monthlySignups.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <span className="hidden group-hover:block absolute -top-6 text-[10px] text-foreground bg-card border border-border rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                  {m.count}
                </span>
                <div
                  className="w-full rounded-t-sm bg-indigo-500/40 hover:bg-indigo-500/70 transition-colors"
                  style={{ height: `${Math.round((m.count / maxSignups) * 100)}%`, minHeight: m.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Plan Distribution</h3>
        <div className="space-y-2">
          {Object.entries(data.planCounts).map(([plan, count]) => {
            const total = Object.values(data.planCounts).reduce((a, b) => a + b, 0)
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const colors: Record<string, string> = {
              free: "#6B7280", pro: "#6366F1", startup: "#F59E0B", enterprise: "#10B981",
            }
            const color = colors[plan] ?? "#6366F1"
            return (
              <div key={plan} className="flex items-center gap-3">
                <span className="w-20 text-xs capitalize text-muted-foreground shrink-0">{plan}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="text-xs text-foreground font-medium w-16 text-right">{count.toLocaleString()} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
