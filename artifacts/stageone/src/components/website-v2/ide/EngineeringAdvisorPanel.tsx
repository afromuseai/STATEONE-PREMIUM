// ─── EngineeringAdvisorPanel — Autonomous Engineering Advisor UI ─────────────
// Phase 16.2
//
// Continuously analyzes the current website project and proactively recommends
// the highest-value engineering improvements. Never edits code — only observes,
// analyzes, prioritizes, and recommends.
//
// Displays overall health, next best action, prioritized recommendations with
// impact/effort/confidence, trend indicators, strengths, and risks.
//
// Architecture:
//   Engineering Advisor → SSE → EngineeringAdvisorPanel
//                            → Live Advisory Display
//                            → Execution Complete (persistent summary)

import { useEffect, useReducer, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Target,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Shield,
  Zap,
  Clock,
  BarChart3,
  ThumbsUp,
  AlertOctagon,
  Info,
  ArrowRight,
  FileText,
  Layers,
  Search,
  Eye,
  Palette,
  Code,
  Users,
  DollarSign,
  GitBranch,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSAdvisorUpdate, WSAdvisorRecommendation } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvisorPanelState {
  /** Overall project health score 0–100. */
  overallHealth: number;
  /** Prioritized recommendations. */
  recommendations: WSAdvisorRecommendation[];
  /** Key strengths. */
  strengths: string[];
  /** Risks and concerns. */
  risks: string[];
  /** Detected trends. */
  trends: string[];
  /** Single highest-value improvement. */
  nextBestAction: string;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
}

type AdvisorAction =
  | { type: "UPDATE"; payload: WSAdvisorUpdate }
  | { type: "RESET" };

function advisorReducer(state: AdvisorPanelState, action: AdvisorAction): AdvisorPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      return {
        ...state,
        overallHealth: p.overallHealth,
        recommendations: p.recommendations,
        strengths: p.strengths,
        risks: p.risks,
        trends: p.trends,
        nextBestAction: p.nextBestAction,
        initialized: true,
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: AdvisorPanelState = {
  overallHealth: 0,
  recommendations: [],
  strengths: [],
  risks: [],
  trends: [],
  nextBestAction: "",
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(category: string): React.ElementType {
  switch (category) {
    case "architecture":       return Layers;
    case "performance":        return Zap;
    case "design":             return Palette;
    case "components":         return Code;
    case "routing":            return GitBranch;
    case "seo":                return Search;
    case "accessibility":      return Eye;
    case "technical-debt":     return AlertOctagon;
    case "developer-experience": return Users;
    case "business":           return DollarSign;
    default:                   return Brain;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "architecture":       return "text-purple-400";
    case "performance":        return "text-cyan-400";
    case "design":             return "text-pink-400";
    case "components":         return "text-emerald-400";
    case "routing":            return "text-orange-400";
    case "seo":                return "text-blue-400";
    case "accessibility":      return "text-amber-400";
    case "technical-debt":     return "text-red-400";
    case "developer-experience": return "text-indigo-400";
    case "business":           return "text-yellow-400";
    default:                   return "text-white/40";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "text-red-400";
    case "high":     return "text-amber-400";
    case "medium":   return "text-cyan-400";
    case "low":      return "text-white/40";
    default:         return "text-white/40";
  }
}

function getPriorityBg(priority: string): string {
  switch (priority) {
    case "critical": return "bg-red-400/10 border-red-400/20";
    case "high":     return "bg-amber-400/10 border-amber-400/20";
    case "medium":   return "bg-cyan-400/10 border-cyan-400/20";
    case "low":      return "bg-white/5 border-white/10";
    default:         return "bg-white/5 border-white/10";
  }
}

function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getHealthBg(score: number): string {
  if (score >= 80) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 60) return "bg-amber-400/10 border-amber-400/20";
  if (score >= 40) return "bg-orange-400/10 border-orange-400/20";
  return "bg-red-400/10 border-red-400/20";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Score ring (circular meter) */
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 80 ? "#34d399" : clamped >= 60 ? "#fbbf24" : clamped >= 40 ? "#fb923c" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={4}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{Math.round(clamped)}</span>
    </div>
  );
}

/** Score meter bar */
function ScoreMeter({ score, color = "emerald", size = "sm" }: { score: number; color?: string; size?: "sm" | "md" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "md" ? "h-2" : "h-1.5";
  const barColor = color;

  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/5 ${barHeight}`}>
      <motion.div
        className={`h-full rounded-full ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${clampedScore}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

/** Recommendation card */
function RecommendationCard({ rec }: { rec: WSAdvisorRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getCategoryIcon(rec.category);
  const catColor = getCategoryColor(rec.category);

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${getPriorityBg(rec.priority)}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="mt-0.5">
          <Icon className={`h-3.5 w-3.5 ${catColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-white/80">{rec.title}</span>
            <span className={`text-[9px] font-medium uppercase ${getPriorityColor(rec.priority)}`}>
              {rec.priority}
            </span>
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2">{rec.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[9px] text-white/30">
              Impact: <span className="text-emerald-400">{rec.impact}</span>
            </span>
            <span className="text-[9px] text-white/30">
              Effort: <span className="text-amber-400">{rec.effort}</span>
            </span>
            <span className="text-[9px] text-white/30">
              Confidence: <span className="text-cyan-400">{rec.confidence}%</span>
            </span>
            <span className="text-[9px] text-white/30">
              Score: <span className="text-purple-400">{rec.score}</span>
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="mt-1 h-3 w-3 shrink-0 text-white/30" /> : <ChevronDown className="mt-1 h-3 w-3 shrink-0 text-white/30" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2 overflow-hidden border-t border-white/5 pt-2"
          >
            {rec.suggestedActions.length > 0 && (
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Suggested Actions</span>
                <ul className="mt-1 space-y-1">
                  {rec.suggestedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-white/50">
                      <ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-emerald-400" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rec.affectedFiles.length > 0 && (
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Affected Files</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {rec.affectedFiles.map((f, i) => (
                    <span key={i} className="inline-block rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
                      {f.split("/").pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Trend indicator */
function TrendBadge({ trend }: { trend: string }) {
  const isPositive = trend.toLowerCase().includes("improving");
  const isNegative = trend.toLowerCase().includes("declining") || trend.toLowerCase().includes("growing") || trend.toLowerCase().includes("increasing");

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${
      isPositive ? "bg-emerald-400/10 text-emerald-300" : isNegative ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"
    }`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
      {trend}
    </div>
  );
}

// ─── EngineeringAdvisorPanel Component ────────────────────────────────────────

interface EngineeringAdvisorPanelProps {
  /** Optional external state override */
  externalState?: AdvisorPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringAdvisorPanel({ externalState, compact = false }: EngineeringAdvisorPanelProps) {
  const [state, dispatch] = useReducer(advisorReducer, initialState);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showStrengths, setShowStrengths] = useState(false);
  const [showRisks, setShowRisks] = useState(false);

  // Subscribe to advisor events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "AdvisorUpdate") {
        const update = event.payload as unknown as WSAdvisorUpdate;
        dispatch({ type: "UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  if (!displayState.initialized && !externalState) return null;

  const healthColor = getHealthColor(displayState.overallHealth);
  const healthBg = getHealthBg(displayState.overallHealth);

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-white/80">Engineering Advisor</span>
        </div>
        {displayState.recommendations.length > 0 && (
          <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
            {displayState.recommendations.length} recommendation{displayState.recommendations.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Overall Health + Next Best Action ───────────────────────────── */}
      <div className="mx-4 mb-3 flex items-start gap-4">
        <ScoreRing score={displayState.overallHealth} size={64} />
        <div className="min-w-0 flex-1">
          <div className={`mb-2 rounded-lg border px-2.5 py-1.5 ${healthBg}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Shield className={`h-3 w-3 ${healthColor}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${healthColor}`}>
                Overall Health
              </span>
              <span className={`text-xs font-bold ${healthColor}`}>{displayState.overallHealth}/100</span>
            </div>
            <ScoreMeter score={displayState.overallHealth} color={healthColor.replace("text-", "bg-")} size="sm" />
          </div>
          {displayState.nextBestAction && (
            <div className="flex items-start gap-1.5 rounded-lg border border-purple-400/20 bg-purple-400/5 px-2.5 py-1.5">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
              <p className="text-[10px] text-purple-300/80 leading-relaxed">
                <span className="font-medium text-purple-300">Next Best Action:</span> {displayState.nextBestAction}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Trends ──────────────────────────────────────────────────────── */}
      {displayState.trends.length > 0 && (
        <div className="mx-4 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {displayState.trends.map((t, i) => (
              <TrendBadge key={i} trend={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── Recommendations ─────────────────────────────────────────────── */}
      {displayState.recommendations.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Recommendations ({displayState.recommendations.length})
              </span>
            </div>
            {showRecommendations ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showRecommendations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                {displayState.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Strengths ───────────────────────────────────────────────────── */}
      {displayState.strengths.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowStrengths(!showStrengths)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Strengths ({displayState.strengths.length})
              </span>
            </div>
            {showStrengths ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showStrengths && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
              >
                {displayState.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    <p className="text-[11px] text-white/60 leading-relaxed">{s}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Risks ───────────────────────────────────────────────────────── */}
      {displayState.risks.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRisks(!showRisks)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Risks ({displayState.risks.length})
              </span>
            </div>
            {showRisks ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showRisks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
              >
                {displayState.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                    <p className="text-[11px] text-amber-300/70 leading-relaxed">{r}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
