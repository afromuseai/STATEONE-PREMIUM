// ─── EngineeringProductPanel — Product Intelligence Engine UI ─────────────────
// Phase 16.1
//
// Evaluates engineering decisions against business goals, UX, branding,
// accessibility, SEO, and conversion. Displays dimension scores, a
// recommendation banner, warnings, reasoning, and collapsible sections.
//
// Architecture:
//   Product Intelligence Engine → SSE → EngineeringProductPanel
//                                    → Live Assessment Display
//                                    → Execution Complete (persistent summary)

import { useEffect, useReducer, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Target,
  Users,
  DollarSign,
  Palette,
  Eye,
  Search,
  Code,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  FileWarning,
  Info,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSProductUpdate, WSProductRecommendation } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductPanelState {
  /** Overall product score 0–100. */
  overallScore: number;
  /** Final recommendation. */
  recommendation: WSProductRecommendation | null;
  /** Business alignment score. */
  businessAlignment: number;
  /** UX impact score. */
  uxImpact: number;
  /** Conversion impact score. */
  conversionImpact: number;
  /** Branding consistency score. */
  brandingConsistency: number;
  /** Accessibility impact score. */
  accessibilityImpact: number;
  /** SEO impact score. */
  seoImpact: number;
  /** Maintainability impact score. */
  maintainabilityImpact: number;
  /** User risk score. */
  userRisk: number;
  /** Reasoning summary. */
  reasoning: string[];
  /** Improvement recommendations. */
  recommendations: string[];
  /** Warnings. */
  warnings: string[];
  /** Assessment duration in ms. */
  assessmentTimeMs: number;
  /** ISO timestamp. */
  timestamp: string | null;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
}

type ProductAction =
  | { type: "UPDATE"; payload: WSProductUpdate }
  | { type: "RESET" };

function productReducer(state: ProductPanelState, action: ProductAction): ProductPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      return {
        ...state,
        overallScore: p.overallScore,
        recommendation: p.recommendation,
        businessAlignment: p.businessAlignment,
        uxImpact: p.uxImpact,
        conversionImpact: p.conversionImpact,
        brandingConsistency: p.brandingConsistency,
        accessibilityImpact: p.accessibilityImpact,
        seoImpact: p.seoImpact,
        maintainabilityImpact: p.maintainabilityImpact,
        userRisk: p.userRisk,
        reasoning: p.reasoning,
        recommendations: p.recommendations,
        warnings: p.warnings,
        assessmentTimeMs: p.assessmentTimeMs,
        timestamp: p.timestamp,
        initialized: true,
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: ProductPanelState = {
  overallScore: 0,
  recommendation: null,
  businessAlignment: 0,
  uxImpact: 0,
  conversionImpact: 0,
  brandingConsistency: 0,
  accessibilityImpact: 0,
  seoImpact: 0,
  maintainabilityImpact: 0,
  userRisk: 0,
  reasoning: [],
  recommendations: [],
  warnings: [],
  assessmentTimeMs: 0,
  timestamp: null,
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecommendationIcon(rec: WSProductRecommendation | null): React.ElementType {
  switch (rec) {
    case "approve":             return ThumbsUp;
    case "approve-with-warning": return AlertTriangle;
    case "revise":              return RefreshCw;
    case "reject":              return ThumbsDown;
    default:                    return Brain;
  }
}

function getRecommendationColor(rec: WSProductRecommendation | null): string {
  switch (rec) {
    case "approve":              return "text-emerald-400";
    case "approve-with-warning": return "text-amber-400";
    case "revise":               return "text-cyan-400";
    case "reject":               return "text-red-400";
    default:                     return "text-white/40";
  }
}

function getRecommendationBg(rec: WSProductRecommendation | null): string {
  switch (rec) {
    case "approve":              return "bg-emerald-400/10 border-emerald-400/20";
    case "approve-with-warning": return "bg-amber-400/10 border-amber-400/20";
    case "revise":               return "bg-cyan-400/10 border-cyan-400/20";
    case "reject":               return "bg-red-400/10 border-red-400/20";
    default:                     return "bg-white/5 border-white/10";
  }
}

function getRecommendationLabel(rec: WSProductRecommendation | null): string {
  switch (rec) {
    case "approve":              return "Approved";
    case "approve-with-warning": return "Approved with Warnings";
    case "revise":               return "Revise";
    case "reject":               return "Rejected";
    default:                     return "Pending";
  }
}

interface DimensionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  getScore: (state: ProductPanelState) => number;
}

const DIMENSIONS: DimensionDef[] = [
  { key: "business",       label: "Business Alignment",       icon: Target,     color: "text-emerald-400", getScore: (s) => s.businessAlignment },
  { key: "ux",             label: "UX Impact",                icon: Users,      color: "text-cyan-400",    getScore: (s) => s.uxImpact },
  { key: "conversion",     label: "Conversion Impact",        icon: TrendingUp, color: "text-amber-400",   getScore: (s) => s.conversionImpact },
  { key: "branding",       label: "Branding Consistency",     icon: Palette,    color: "text-purple-400",  getScore: (s) => s.brandingConsistency },
  { key: "accessibility",  label: "Accessibility Impact",     icon: Eye,        color: "text-blue-400",    getScore: (s) => s.accessibilityImpact },
  { key: "seo",            label: "SEO Impact",               icon: Search,     color: "text-orange-400",  getScore: (s) => s.seoImpact },
  { key: "maintainability",label: "Maintainability Impact",   icon: Code,       color: "text-pink-400",    getScore: (s) => s.maintainabilityImpact },
  { key: "userRisk",       label: "User Risk (inverted)",     icon: ShieldAlert,color: "text-red-400",     getScore: (s) => 100 - s.userRisk },
];

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Score ring (circular meter) */
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
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

/** Score meter bar (reused pattern) */
function ScoreMeter({ score, color = "emerald", size = "sm" }: { score: number; color?: string; size?: "sm" | "md" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "md" ? "h-2" : "h-1.5";
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
    red: "bg-red-400",
    orange: "bg-orange-400",
    purple: "bg-purple-400",
    blue: "bg-blue-400",
    pink: "bg-pink-400",
  };
  const barColor = colorMap[color] ?? "bg-emerald-400";

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

/** Dimension row */
function DimensionRow({ dim, state }: { dim: DimensionDef; state: ProductPanelState }) {
  const score = dim.getScore(state);
  return (
    <div className="flex items-center gap-2 py-1">
      <dim.icon className={`h-3.5 w-3.5 ${dim.color} shrink-0`} />
      <span className="text-[10px] text-white/50 flex-1 truncate">{dim.label}</span>
      <span className={`text-[11px] font-medium ${dim.color}`}>{Math.round(score)}%</span>
      <div className="w-16">
        <ScoreMeter score={score} color={dim.color.split("-")[1] ?? "emerald"} />
      </div>
    </div>
  );
}

// ─── EngineeringProductPanel Component ────────────────────────────────────────

interface EngineeringProductPanelProps {
  /** Optional external state override */
  externalState?: ProductPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringProductPanel({ externalState, compact = false }: EngineeringProductPanelProps) {
  const [state, dispatch] = useReducer(productReducer, initialState);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  // Subscribe to product events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "ProductUpdate") {
        const update = event.payload as unknown as WSProductUpdate;
        dispatch({ type: "UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  if (!displayState.initialized && !externalState) return null;

  const rec = displayState.recommendation;
  const RecIcon = getRecommendationIcon(rec);
  const recColor = getRecommendationColor(rec);

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-white/80">Product Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
          {displayState.assessmentTimeMs > 0 && (
            <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {displayState.assessmentTimeMs}ms
            </span>
          )}
        </div>
      </div>

      {/* ── Recommendation Banner ───────────────────────────────────────── */}
      {rec && (
        <div className={`mx-4 mb-3 rounded-lg border px-3 py-2.5 ${getRecommendationBg(rec)}`}>
          <div className="flex items-center gap-2">
            <RecIcon className={`h-4 w-4 ${recColor}`} />
            <span className={`text-xs font-semibold ${recColor}`}>
              {getRecommendationLabel(rec)}
            </span>
          </div>
        </div>
      )}

      {/* ── Score Ring + Summary ────────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex items-start gap-4">
        <ScoreRing score={displayState.overallScore} size={72} />
        <div className="min-w-0 flex-1 space-y-1">
          {displayState.warnings.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
              <div className="min-w-0">
                {displayState.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-300/80 leading-relaxed">{w}</p>
                ))}
              </div>
            </div>
          )}
          {displayState.reasoning.length > 0 && !compact && (
            <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
              {displayState.reasoning[0]}
            </p>
          )}
        </div>
      </div>

      {/* ── Dimension Scores ────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <button
          onClick={() => setShowDimensions(!showDimensions)}
          className="mb-2 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              Dimension Scores
            </span>
          </div>
          {showDimensions ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
        </button>
        <AnimatePresence>
          {showDimensions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
            >
              {DIMENSIONS.map((dim) => (
                <DimensionRow key={dim.key} dim={dim} state={displayState} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Recommendations ─────────────────────────────────────────────── */}
      {displayState.recommendations.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-cyan-400" />
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
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
              >
                {displayState.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <Star className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    <p className="text-[11px] text-white/60 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Reasoning ───────────────────────────────────────────────────── */}
      {displayState.reasoning.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Assessment Details
              </span>
            </div>
            {showReasoning ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showReasoning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
              >
                {displayState.reasoning.map((r, i) => (
                  <p key={i} className="text-[11px] text-white/60 leading-relaxed py-0.5">{r}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
