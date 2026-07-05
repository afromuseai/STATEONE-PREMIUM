import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth-context"
import {
  TrendingUp, TrendingDown, Minus, Brain, BarChart3, AlertTriangle,
  CheckCircle2, Lightbulb, Target, Zap, RefreshCw, ArrowUpRight,
  ArrowDownRight, Shield, Activity, Sparkles
} from "lucide-react"

interface BusinessMetric {
  id: string
  metricKey: string
  metricValue: number
  previousValue?: number
  trend: string
  category: string
  period: string
  forecastValue?: number
  forecastConfidence?: number
  unit?: string
  recordedAt: string
}

interface HealthData {
  score: number
  breakdown: { operationalEfficiency: number; automationMaturity: number; aiUtilization: number; scalabilityReadiness: number }
  trends: { up: number; down: number; stable: number }
  recommendations: { type: string; text: string; priority: string }[]
  projectCount: number
  taskCount: number
  executionCount: number
}

interface ForecastData {
  forecasts: { metricKey: string; currentValue: number; forecastValue: number | null; forecastConfidence: number | null; trend: string; category: string }[]
  opportunities: { title: string; impact: string; effort: string; category: string; estimatedGain: string }[]
  risks: { title: string; severity: string; probability: string; mitigation: string }[]
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-400" />
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-400" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444"
  const r = 40
  const circumference = 2 * Math.PI * r
  const progress = (score / 100) * circumference
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground">{score}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">score</span>
      </div>
  )
}

export default function IntelligencePage() {
  const [tab, setTab] = useState<"health" | "metrics" | "forecast">("health")
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ["intelligence-health", user?.id],
    queryFn: () => fetch("/api/intelligence/health", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  })

  const { data: metricsData, isLoading: metricsLoading } = useQuery<{ metrics: BusinessMetric[] }>({
    queryKey: ["intelligence-metrics", user?.id],
    queryFn: () => fetch("/api/intelligence/metrics", { credentials: "include" }).then(r => r.json()),
  })

  const { data: forecastData, isLoading: forecastLoading } = useQuery<ForecastData>({
    queryKey: ["intelligence-forecast", user?.id],
    queryFn: () => fetch("/api/intelligence/forecast", { credentials: "include" }).then(r => r.json()),
  })

  const seedMutation = useMutation({
    mutationFn: () => fetch("/api/intelligence/metrics/seed", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intelligence-metrics", user?.id] })
      qc.invalidateQueries({ queryKey: ["intelligence-health", user?.id] })
      qc.invalidateQueries({ queryKey: ["intelligence-forecast", user?.id] })
    },
  })

  const metrics = metricsData?.metrics ?? []
  const forecasts = forecastData?.forecasts ?? []
  const opportunities = forecastData?.opportunities ?? []
  const risks = forecastData?.risks ?? []

  const RECOMMENDATION_COLORS: Record<string, string> = {
    warning: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    info: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    error: "text-red-400 bg-red-500/10 border-red-500/20",
  }

  const IMPACT_COLORS: Record<string, string> = { high: "text-red-400", medium: "text-yellow-400", low: "text-emerald-400" }
  const EFFORT_COLORS: Record<string, string> = { high: "text-red-400", medium: "text-yellow-400", low: "text-emerald-400" }
  const SEVERITY_COLORS: Record<string, string> = { high: "text-red-400", medium: "text-yellow-400", low: "text-emerald-400" }

  const CATEGORY_ICONS: Record<string, typeof BarChart3> = { revenue: BarChart3, growth: TrendingUp, efficiency: Zap, risk: Shield, general: Activity }

  return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-white/5 bg-[#0a0a0a] px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25">
                  <Brain className="h-4 w-4 text-violet-400" />
                </div>
                <h1 className="text-lg font-bold text-foreground">Predictive Intelligence</h1>
                <span className="text-[9px] font-black uppercase tracking-widest bg-violet-500/20 text-violet-400 border border-violet-500/25 px-1.5 py-0.5 rounded-full">AI</span>
              </div>
              <p className="text-xs text-muted-foreground">Business health scoring, predictive analytics, and AI-powered growth recommendations</p>
            </div>
            <div className="flex items-center gap-3">
              {metrics.length === 0 && (
                <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
                  className="flex items-center gap-2 text-xs font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl px-3 py-1.5 hover:bg-violet-500/20 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" />
                  {seedMutation.isPending ? "Seeding…" : "Seed Demo Data"}
                </button>
              )}
              <div className="flex rounded-xl border border-white/8 overflow-hidden">
                {(["health", "metrics", "forecast"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-white/4"}`}>
                    {t === "health" ? "Health Score" : t === "metrics" ? `Metrics (${metrics.length})` : "Forecast"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "health" && (
            <div className="space-y-5">
              {healthLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" /></div>
              ) : healthData ? (
                <>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="col-span-1 bg-white/2 border border-white/6 rounded-2xl p-6 flex flex-col items-center justify-center">
                      <p className="text-xs text-muted-foreground mb-4 font-semibold uppercase tracking-wider">Overall Health</p>
                      <ScoreRing score={healthData.score} />
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-400" />{healthData.trends.up} up</span>
                        <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-400" />{healthData.trends.down} down</span>
                        <span className="flex items-center gap-1"><Minus className="h-3 w-3 text-muted-foreground" />{healthData.trends.stable} stable</span>
                      </div>
                    </div>
                    <div className="col-span-2 bg-white/2 border border-white/6 rounded-2xl p-6">
                      <p className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Score Breakdown</p>
                      <div className="space-y-4">
                        {Object.entries(healthData.breakdown).map(([key, val]) => {
                          const label = key.replace(/([A-Z])/g, " $1").trim()
                          const pct = val as number
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground capitalize">{label}</span>
                                <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-yellow-400" : "text-red-400"}`}>{pct}%</span>
                              </div>
                              <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: 0.1 }}
                                  className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Projects", value: healthData.projectCount, icon: Target, color: "text-primary" },
                      { label: "Agent Tasks", value: healthData.taskCount, icon: Activity, color: "text-blue-400" },
                      { label: "Executions", value: healthData.executionCount, icon: Zap, color: "text-orange-400" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="bg-white/2 border border-white/6 rounded-2xl p-4 flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-foreground">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {healthData.recommendations.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        AI Recommendations
                      </p>
                      <div className="space-y-2">
                        {healthData.recommendations.map((rec, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                            className={`flex items-start gap-3 p-3 border rounded-xl ${RECOMMENDATION_COLORS[rec.type] ?? "text-muted-foreground bg-white/5 border-white/10"}`}>
                            {rec.type === "warning" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : rec.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs">{rec.text}</p>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-wider shrink-0 opacity-70`}>{rec.priority}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {tab === "metrics" && (
            <div className="space-y-3">
              {metricsLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" /></div>
              ) : metrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No metrics recorded</p>
                  <p className="text-xs text-muted-foreground/60 mb-4">Click "Seed Demo Data" to load sample business metrics</p>
                  <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
                    className="text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors">
                    {seedMutation.isPending ? "Seeding…" : "Seed Demo Data"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {metrics.map((metric, i) => {
                    const CatIcon = CATEGORY_ICONS[metric.category] ?? Activity
                    const pctChange = metric.previousValue && metric.previousValue !== 0
                      ? ((metric.metricValue - metric.previousValue) / metric.previousValue * 100)
                      : 0
                    return (
                      <motion.div key={metric.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="bg-white/2 border border-white/6 rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CatIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground capitalize">{metric.category} · {metric.period}</span>
                          </div>
                          <TrendIcon trend={metric.trend} />
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1 capitalize">{metric.metricKey.replace(/_/g, " ")}</p>
                        <div className="flex items-end gap-2 mb-2">
                          <p className="text-2xl font-black text-foreground">
                            {metric.unit === "USD" ? "$" : ""}{metric.metricValue.toLocaleString()}{metric.unit && metric.unit !== "USD" ? <span className="text-sm text-muted-foreground font-normal ml-0.5">{metric.unit}</span> : null}
                          </p>
                          {pctChange !== 0 && (
                            <div className={`flex items-center gap-0.5 text-xs font-semibold mb-1 ${pctChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pctChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(pctChange).toFixed(1)}%
                            </div>
                          )}
                        </div>
                        {metric.forecastValue != null && (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <span className="text-xs text-muted-foreground">Forecast</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-violet-400">
                                {metric.unit === "USD" ? "$" : ""}{metric.forecastValue?.toLocaleString()}{metric.unit && metric.unit !== "USD" ? metric.unit : ""}
                              </span>
                              {metric.forecastConfidence != null && (
                                <span className="text-[10px] text-muted-foreground">{metric.forecastConfidence}% conf.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "forecast" && (
            <div className="space-y-6">
              {forecastLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" /></div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Growth Opportunities
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {opportunities.map((opp, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          className="bg-white/2 border border-white/6 rounded-2xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-semibold text-foreground">{opp.title}</p>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 rounded-full px-1.5 py-0.5 shrink-0 ml-2">{opp.category}</span>
                          </div>
                          <p className="text-xs text-emerald-400 font-semibold mb-2">{opp.estimatedGain}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span>Impact: <span className={`font-bold ${IMPACT_COLORS[opp.impact] ?? "text-foreground"}`}>{opp.impact}</span></span>
                            <span>Effort: <span className={`font-bold ${EFFORT_COLORS[opp.effort] ?? "text-foreground"}`}>{opp.effort}</span></span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      Risk Analysis
                    </p>
                    <div className="space-y-2">
                      {risks.map((risk, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                          className="bg-white/2 border border-white/6 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-semibold text-foreground">{risk.title}</p>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className={`text-[10px] font-black uppercase ${SEVERITY_COLORS[risk.severity] ?? "text-muted-foreground"}`}>
                                {risk.severity} severity
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{risk.mitigation}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {forecasts.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-violet-400" />
                        Metric Forecasts
                      </p>
                      <div className="space-y-2">
                        {forecasts.map((f, i) => (
                          <div key={i} className="flex items-center gap-4 bg-white/2 border border-white/6 rounded-xl px-4 py-3">
                            <TrendIcon trend={f.trend} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground capitalize">{f.metricKey.replace(/_/g, " ")}</p>
                              <p className="text-[10px] text-muted-foreground">{f.category}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">Current: <span className="text-foreground font-semibold">{f.currentValue.toLocaleString()}</span></p>
                              {f.forecastValue != null && <p className="text-xs text-muted-foreground">Forecast: <span className="text-violet-400 font-semibold">{f.forecastValue.toLocaleString()}</span></p>}
                            </div>
                            {f.forecastConfidence != null && (
                              <div className="text-center shrink-0">
                                <p className="text-sm font-bold text-primary">{f.forecastConfidence}%</p>
                                <p className="text-[9px] text-muted-foreground/60">conf</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
