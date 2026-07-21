// ─── EngineeringDecisionPanel — Engineering Decision Intelligence UI ─────────
// Phase 14.6
//
// Displays the engineering decision recommendation, risk assessment, execution
// strategy selection, tradeoff analysis, and reasoning summary during Website
// Studio editing. Updates from SSE events via wsRuntimeEmitter.
//
// Architecture:
//   Decision Engine → SSE → EngineeringDecisionPanel
//                          → Live Recommendation & Strategy Display
//                          → Execution Complete (persistent summary)

import { useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  GitBranch,
  Layers,
  Lightbulb,
  RefreshCw,
  Scale,
  Zap,
  Wrench,
  RotateCcw,
  Hammer,
  FileCode,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type {
  WSDecisionUpdate,
  WSDecisionRecommendation,
  WSExecutionStrategy,
  WSTradeoffCategory,
} from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecisionPanelState {
  /** Final recommendation. */
  recommendation: WSDecisionRecommendation | null;
  /** Confidence in the chosen decision (0–100). */
  confidence: number;
  /** Estimated regression risk (0–100). */
  estimatedRisk: number;
  /** The chosen execution strategy. */
  executionStrategy: WSExecutionStrategy | null;
  /** Short description of chosen option. */
  chosenOption: string;
  /** Alternative options considered. */
  alternativeOptions: WSDecisionUpdate["alternativeOptions"];
  /** Tradeoffs of chosen strategy. */
  tradeoffs: WSDecisionUpdate["tradeoffs"];
  /** Reasoning behind the decision. */
  rationale: string[];
  /** How long the evaluation took (ms). */
  decisionTimeMs: number;
  /** When the decision was made. */
  timestamp: string | null;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
}

type DecisionAction =
  | { type: "UPDATE"; payload: WSDecisionUpdate }
  | { type: "RESET" };

function decisionReducer(state: DecisionPanelState, action: DecisionAction): DecisionPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      return {
        ...state,
        recommendation: p.recommendation,
        confidence: p.confidence,
        estimatedRisk: p.estimatedRisk,
        executionStrategy: p.executionStrategy,
        chosenOption: p.chosenOption,
        alternativeOptions: p.alternativeOptions,
        tradeoffs: p.tradeoffs,
        rationale: p.rationale,
        decisionTimeMs: p.decisionTimeMs,
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

const initialState: DecisionPanelState = {
  recommendation: null,
  confidence: 0,
  estimatedRisk: 0,
  executionStrategy: null,
  chosenOption: "",
  alternativeOptions: [],
  tradeoffs: [],
  rationale: [],
  decisionTimeMs: 0,
  timestamp: null,
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecommendationIcon(rec: WSDecisionRecommendation | null): React.ElementType {
  switch (rec) {
    case "proceed":       return ShieldCheck;
    case "repair-first":  return Wrench;
    case "ask-user":      return Lightbulb;
    case "rollback":      return RotateCcw;
    case "defer":         return XCircle;
    default:              return Brain;
  }
}

function getRecommendationColor(rec: WSDecisionRecommendation | null): string {
  switch (rec) {
    case "proceed":       return "text-emerald-400";
    case "repair-first":  return "text-amber-400";
    case "ask-user":      return "text-cyan-400";
    case "rollback":      return "text-orange-400";
    case "defer":         return "text-red-400";
    default:              return "text-white/40";
  }
}

function getRecommendationBg(rec: WSDecisionRecommendation | null): string {
  switch (rec) {
    case "proceed":       return "bg-emerald-400/10 border-emerald-400/20";
    case "repair-first":  return "bg-amber-400/10 border-amber-400/20";
    case "ask-user":      return "bg-cyan-400/10 border-cyan-400/20";
    case "rollback":      return "bg-orange-400/10 border-orange-400/20";
    case "defer":         return "bg-red-400/10 border-red-400/20";
    default:              return "bg-white/5 border-white/10";
  }
}

function getRecommendationLabel(rec: WSDecisionRecommendation | null): string {
  switch (rec) {
    case "proceed":       return "Proceed";
    case "repair-first":  return "Repair First";
    case "ask-user":      return "Ask User";
    case "rollback":      return "Rollback";
    case "defer":         return "Defer";
    default:              return "Unknown";
  }
}

function getStrategyIcon(strategy: WSExecutionStrategy | null): React.ElementType {
  switch (strategy) {
    case "patch":    return GitBranch;
    case "refactor": return Hammer;
    case "replace":  return RefreshCw;
    case "extend":   return Layers;
    case "rebuild":  return Zap;
    default:         return Brain;
  }
}

function getStrategyColor(strategy: WSExecutionStrategy | null): string {
  switch (strategy) {
    case "patch":    return "text-emerald-400";
    case "refactor": return "text-purple-400";
    case "replace":  return "text-orange-400";
    case "extend":   return "text-cyan-400";
    case "rebuild":  return "text-red-400";
    default:         return "text-white/40";
  }
}

function getStrategyLabel(strategy: WSExecutionStrategy | null): string {
  switch (strategy) {
    case "patch":    return "Patch";
    case "refactor": return "Refactor";
    case "replace":  return "Replace";
    case "extend":   return "Extend";
    case "rebuild":  return "Rebuild";
    default:         return "Unknown";
  }
}

function getTradeoffCategoryIcon(category: WSTradeoffCategory): React.ElementType {
  switch (category) {
    case "performance":         return Zap;
    case "maintainability":     return Layers;
    case "complexity":          return GitBranch;
    case "risk":                return ShieldAlert;
    case "design":              return Lightbulb;
    case "developer-experience": return Brain;
  }
}

function getTradeoffCategoryColor(category: WSTradeoffCategory): string {
  switch (category) {
    case "performance":         return "text-cyan-400";
    case "maintainability":     return "text-emerald-400";
    case "complexity":          return "text-purple-400";
    case "risk":                return "text-amber-400";
    case "design":              return "text-blue-400";
    case "developer-experience": return "text-pink-400";
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Score meter bar (reused pattern) */
function ScoreMeter({ score, color = "emerald", size = "md" }: { score: number; color?: string; size?: "sm" | "md" | "lg" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
    red: "bg-red-400",
    orange: "bg-orange-400",
    purple: "bg-purple-400",
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

/** Strategy badge */
function StrategyBadge({ strategy }: { strategy: WSExecutionStrategy }) {
  const Icon = getStrategyIcon(strategy);
  const color = getStrategyColor(strategy);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
    >
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] font-medium" style={{ color }}>{getStrategyLabel(strategy)}</span>
    </div>
  );
}

/** Alternative option card */
function AlternativeCard({ option }: { option: WSDecisionUpdate["alternativeOptions"][0] }) {
  const stratColor = getStrategyColor(option.strategy);
  return (
    <div className="rounded-lg border border-[#303030] bg-[#1E1E1E] p-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-white/40">{option.id}</span>
        <span className="text-[10px] font-medium text-white/60 truncate flex-1">{option.title}</span>
        <StrategyBadge strategy={option.strategy} />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-white/40">
        <span>Confidence: <span className="text-white/60">{option.confidence}%</span></span>
        <span>Risk: <span className="text-white/60">{option.risk}%</span></span>
        <span>Files: <span className="text-white/60">{option.estimatedFiles}</span></span>
      </div>
    </div>
  );
}

/** Tradeoff row */
function TradeoffRow({ tradeoff }: { tradeoff: WSDecisionUpdate["tradeoffs"][0] }) {
  const Icon = getTradeoffCategoryIcon(tradeoff.category);
  const color = getTradeoffCategoryColor(tradeoff.category);
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium uppercase tracking-wider ${color}`}>
            {tradeoff.category}
          </span>
        </div>
        <div className="mt-0.5 space-y-0.5">
          <p className="text-[11px] text-emerald-300/70">+ {tradeoff.benefit}</p>
          <p className="text-[11px] text-red-300/60">− {tradeoff.drawback}</p>
        </div>
      </div>
    </div>
  );
}

// ─── EngineeringDecisionPanel Component ───────────────────────────────────────

interface EngineeringDecisionPanelProps {
  /** Optional external state override */
  externalState?: DecisionPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringDecisionPanel({ externalState, compact = false }: EngineeringDecisionPanelProps) {
  const [state, dispatch] = useReducer(decisionReducer, initialState);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showTradeoffs, setShowTradeoffs] = useState(false);
  const [showRationale, setShowRationale] = useState(true);

  // Subscribe to decision events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "DecisionUpdate") {
        const update = event.payload as unknown as WSDecisionUpdate;
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
          <span className="text-sm font-medium text-white/80">Engineering Decision</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
          {displayState.decisionTimeMs > 0 && (
            <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {displayState.decisionTimeMs}ms
            </span>
          )}
        </div>
      </div>

      {/* ── Recommendation Banner ───────────────────────────────────────── */}
      {rec && (
        <div className={`mx-4 mb-3 rounded-lg border px-3 py-2.5 ${getRecommendationBg(rec)}`}>
          <div className="flex items-center gap-2 mb-1">
            <RecIcon className={`h-4 w-4 ${recColor}`} />
            <span className={`text-xs font-semibold ${recColor}`}>
              {getRecommendationLabel(rec)}
            </span>
            {displayState.executionStrategy && (
              <StrategyBadge strategy={displayState.executionStrategy} />
            )}
          </div>
          {displayState.chosenOption && (
            <p className="text-[11px] text-white/60 leading-relaxed">
              {displayState.chosenOption}
            </p>
          )}
        </div>
      )}

      {/* ── Confidence & Risk meters ────────────────────────────────────── */}
      <div className="mx-4 mb-3 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Confidence</span>
            </div>
            <span className="text-[11px] font-medium text-emerald-400">{displayState.confidence}%</span>
          </div>
          <ScoreMeter score={displayState.confidence} color="emerald" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Risk</span>
            </div>
            <span className="text-[11px] font-medium text-amber-400">{displayState.estimatedRisk}%</span>
          </div>
          <ScoreMeter score={displayState.estimatedRisk} color="amber" />
        </div>
      </div>

      {/* ── Alternative Options ─────────────────────────────────────────── */}
      {displayState.alternativeOptions.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Alternatives ({displayState.alternativeOptions.length})
              </span>
            </div>
            {showAlternatives ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showAlternatives && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                {displayState.alternativeOptions.map((alt, i) => (
                  <AlternativeCard key={i} option={alt} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Tradeoffs ───────────────────────────────────────────────────── */}
      {displayState.tradeoffs.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowTradeoffs(!showTradeoffs)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Scale className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Tradeoffs ({displayState.tradeoffs.length})
              </span>
            </div>
            {showTradeoffs ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showTradeoffs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-1"
              >
                {displayState.tradeoffs.map((t, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="border-t border-white/5" />}
                    <TradeoffRow tradeoff={t} />
                  </React.Fragment>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Rationale ───────────────────────────────────────────────────── */}
      {displayState.rationale.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRationale(!showRationale)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Reasoning Summary
              </span>
            </div>
            {showRationale ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showRationale && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2"
              >
                {displayState.rationale.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <ArrowRight className="h-3 w-3 text-purple-400/60 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-white/60 leading-relaxed">{r}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Bottom spacing ──────────────────────────────────────────────── */}
      <div className="h-2" />
    </div>
  );
}
