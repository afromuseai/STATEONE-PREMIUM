// ─── EngineeringAuditPanel — Continuous Engineering Audit UI ─────────────────
// Phase 15.1
//
// Displays the engineering audit results — overall score, detected improvement
// opportunities, strengths, weaknesses, and actionable recommendations — during
// Website Studio editing. Updates from SSE events via wsRuntimeEmitter.
//
// Architecture:
//   Continuous Engineering Engine → SSE → EngineeringAuditPanel
//                                          → Live Audit Score & Opportunity Display
//                                          → Filterable, Ranked Opportunity List

import { useEffect, useReducer, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Code2,
  FileCode,
  FileSearch,
  Layers,
  Lightbulb,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Search,
  XCircle,
  Route,
  Eye,
  Globe,
  Gauge,
  Wrench,
  BookOpen,
  Hammer,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type {
  WSAuditUpdate,
  WSAuditCategory,
  WSAuditSeverity,
  WSAuditEffort,
} from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditPanelState {
  /** Overall engineering score 0–100. */
  score: number;
  /** Detected opportunities. */
  opportunities: WSAuditUpdate["topOpportunities"];
  /** Critical issues count. */
  criticalCount: number;
  /** High priority count. */
  highPriorityCount: number;
  /** Project strengths. */
  strengths: string[];
  /** Areas needing improvement. */
  weaknesses: string[];
  /** Human-readable summary. */
  summary: string;
  /** Audit duration in ms. */
  durationMs: number;
  /** When the audit was performed. */
  timestamp: string | null;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
}

type AuditAction =
  | { type: "UPDATE"; payload: WSAuditUpdate }
  | { type: "RESET" };

function auditReducer(state: AuditPanelState, action: AuditAction): AuditPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      return {
        ...state,
        score: p.score,
        opportunities: p.topOpportunities,
        criticalCount: p.criticalCount,
        highPriorityCount: p.highPriorityCount,
        strengths: p.strengths,
        weaknesses: p.weaknesses,
        summary: p.summary,
        durationMs: p.durationMs,
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

const initialState: AuditPanelState = {
  score: 0,
  opportunities: [],
  criticalCount: 0,
  highPriorityCount: 0,
  strengths: [],
  weaknesses: [],
  summary: "",
  durationMs: 0,
  timestamp: null,
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(category: WSAuditCategory): React.ElementType {
  switch (category) {
    case "performance":         return Gauge;
    case "architecture":        return Layers;
    case "design":              return Scale;
    case "components":          return Code2;
    case "routing":             return Route;
    case "accessibility":       return Eye;
    case "seo":                 return Globe;
    case "validation":          return ShieldCheck;
    case "technical-debt":      return Wrench;
    case "developer-experience": return BookOpen;
  }
}

function getCategoryColor(category: WSAuditCategory): string {
  switch (category) {
    case "performance":         return "text-cyan-400";
    case "architecture":        return "text-purple-400";
    case "design":              return "text-blue-400";
    case "components":          return "text-emerald-400";
    case "routing":             return "text-orange-400";
    case "accessibility":       return "text-pink-400";
    case "seo":                 return "text-yellow-400";
    case "validation":          return "text-emerald-400";
    case "technical-debt":      return "text-red-400";
    case "developer-experience": return "text-cyan-300";
  }
}

function getCategoryLabel(category: WSAuditCategory): string {
  switch (category) {
    case "performance":         return "Performance";
    case "architecture":        return "Architecture";
    case "design":              return "Design";
    case "components":          return "Components";
    case "routing":             return "Routing";
    case "accessibility":       return "Accessibility";
    case "seo":                 return "SEO";
    case "validation":          return "Validation";
    case "technical-debt":      return "Technical Debt";
    case "developer-experience": return "DX";
  }
}

function getSeverityIcon(severity: WSAuditSeverity): React.ElementType {
  switch (severity) {
    case "critical":  return XCircle;
    case "high":      return AlertTriangle;
    case "medium":    return ShieldAlert;
    case "low":       return CheckCircle2;
  }
}

function getSeverityColor(severity: WSAuditSeverity): string {
  switch (severity) {
    case "critical":  return "text-red-400";
    case "high":      return "text-orange-400";
    case "medium":    return "text-amber-400";
    case "low":       return "text-emerald-400";
  }
}

function getSeverityBg(severity: WSAuditSeverity): string {
  switch (severity) {
    case "critical":  return "border-red-400/20 bg-red-400/5";
    case "high":      return "border-orange-400/20 bg-orange-400/5";
    case "medium":    return "border-amber-400/20 bg-amber-400/5";
    case "low":       return "border-emerald-400/20 bg-emerald-400/5";
  }
}

function getEffortIcon(effort: WSAuditEffort): React.ElementType {
  switch (effort) {
    case "small":  return Zap;
    case "medium": return BarChart3;
    case "large":  return Hammer;
  }
}

function getEffortColor(effort: WSAuditEffort): string {
  switch (effort) {
    case "small":  return "text-emerald-400";
    case "medium": return "text-amber-400";
    case "large":  return "text-red-400";
  }
}

function getEffortLabel(effort: WSAuditEffort): string {
  switch (effort) {
    case "small":  return "Small";
    case "medium": return "Medium";
    case "large":  return "Large";
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-cyan-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function getScoreBarColor(score: number): string {
  if (score >= 90) return "bg-emerald-400";
  if (score >= 75) return "bg-cyan-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Score meter bar (reused pattern) */
function ScoreMeter({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  const barColor = getScoreBarColor(score);

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

/** Category badge */
function CategoryBadge({ category }: { category: WSAuditCategory }) {
  const Icon = getCategoryIcon(category);
  const color = getCategoryColor(category);
  return (
    <div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
      style={{ borderColor: `${color}20`, backgroundColor: `${color}08` }}
    >
      <Icon className="h-2.5 w-2.5" style={{ color }} />
      <span className="text-[9px] font-medium" style={{ color }}>{getCategoryLabel(category)}</span>
    </div>
  );
}

/** Severity badge */
function SeverityBadge({ severity }: { severity: WSAuditSeverity }) {
  const Icon = getSeverityIcon(severity);
  const color = getSeverityColor(severity);
  return (
    <div className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{severity}</span>
    </div>
  );
}

/** Effort badge */
function EffortBadge({ effort }: { effort: WSAuditEffort }) {
  const Icon = getEffortIcon(effort);
  const color = getEffortColor(effort);
  return (
    <div className="inline-flex items-center gap-1">
      <Icon className="h-2.5 w-2.5" style={{ color }} />
      <span className="text-[9px] font-medium" style={{ color }}>{getEffortLabel(effort)}</span>
    </div>
  );
}

/** Opportunity card — the main display item */
function OpportunityCard({
  opportunity,
}: {
  opportunity: WSAuditUpdate["topOpportunities"][0];
}) {
  const [expanded, setExpanded] = useState(false);
  const catColor = getCategoryColor(opportunity.category);

  return (
    <div className={`rounded-lg border ${getSeverityBg(opportunity.severity)}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 p-2.5 text-left"
      >
        <div className="mt-0.5 shrink-0">
          {getSeverityIcon(opportunity.severity)({ className: `h-3.5 w-3.5 ${getSeverityColor(opportunity.severity)}` })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-white/80 leading-tight">
              {opportunity.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={opportunity.category} />
            <EffortBadge effort={opportunity.estimatedEffort} />
            <span className="text-[9px] text-white/30">
              Benefit: {opportunity.estimatedBenefit}% · Risk: {opportunity.estimatedRisk}% · Score: {opportunity.priorityScore}
            </span>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-white/30" />
          ) : (
            <ChevronDown className="h-3 w-3 text-white/30" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 mx-2.5" />
            <div className="p-2.5 space-y-2">
              <p className="text-[11px] text-white/60 leading-relaxed">
                {opportunity.description}
              </p>
              <div>
                <p className="text-[10px] font-medium text-white/40 mb-1">Recommendation</p>
                <div className="rounded-md border border-[#303030] bg-[#1A1A1A] px-2 py-1.5">
                  <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                    {opportunity.recommendation}
                  </p>
                </div>
              </div>
              {opportunity.affectedFiles.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-white/40 mb-1">
                    Affected Files ({opportunity.affectedFiles.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {opportunity.affectedFiles.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/50 font-mono"
                      >
                        <FileCode className="h-2.5 w-2.5 text-white/30" />
                        {f.split("/").pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EngineeringAuditPanel Component ──────────────────────────────────────────

interface EngineeringAuditPanelProps {
  /** Optional external state override */
  externalState?: AuditPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringAuditPanel({ externalState, compact = false }: EngineeringAuditPanelProps) {
  const [state, dispatch] = useReducer(auditReducer, initialState);

  // Filters
  const [showAll, setShowAll] = useState(true);
  const [showCritical, setShowCritical] = useState(true);
  const [showHigh, setShowHigh] = useState(true);
  const [showMedium, setShowMedium] = useState(true);
  const [showLow, setShowLow] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<WSAuditCategory | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  // Subscribe to audit events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "AuditUpdate") {
        const update = event.payload as unknown as WSAuditUpdate;
        dispatch({ type: "UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  if (!displayState.initialized && !externalState) return null;

  // ── Filter opportunities ──────────────────────────────────────────────
  const severityFilter: WSAuditSeverity[] = [];
  if (showCritical) severityFilter.push("critical");
  if (showHigh) severityFilter.push("high");
  if (showMedium) severityFilter.push("medium");
  if (showLow) severityFilter.push("low");

  const filteredOpportunities = displayState.opportunities.filter((opp) => {
    if (!severityFilter.includes(opp.severity)) return false;
    if (selectedCategory !== "all" && opp.category !== selectedCategory) return false;
    return true;
  });

  // Collect unique categories
  const categories = new Set(displayState.opportunities.map((o) => o.category));

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white/80">Engineering Audit</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
          {displayState.durationMs > 0 && (
            <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {displayState.durationMs}ms
            </span>
          )}
        </div>
      </div>

      {/* ── Score Section ───────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${getScoreColor(displayState.score)}`} />
              <span className={`text-lg font-bold ${getScoreColor(displayState.score)}`}>
                {displayState.score}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                {getScoreLabel(displayState.score)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/40">
              {displayState.criticalCount > 0 && (
                <span className="text-red-400">{displayState.criticalCount} critical</span>
              )}
              {displayState.highPriorityCount > 0 && (
                <span className="text-orange-400">{displayState.highPriorityCount} high</span>
              )}
              <span>{displayState.opportunities.length} issues</span>
            </div>
          </div>
          <ScoreMeter score={displayState.score} />
          {displayState.summary && (
            <p className="mt-2 text-[11px] text-white/50 leading-relaxed">
              {displayState.summary}
            </p>
          )}
        </div>
      </div>

      {/* ── Strengths & Weaknesses ──────────────────────────────────────── */}
      {(displayState.strengths.length > 0 || displayState.weaknesses.length > 0) && (
        <div className="mx-4 mb-3 space-y-2">
          {displayState.weaknesses.length > 0 && (
            <div className="rounded-lg border border-orange-400/10 bg-orange-400/[0.03] px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-orange-400/60 mb-1.5">
                Areas for Improvement
              </p>
              <div className="space-y-1">
                {displayState.weaknesses.slice(0, 3).map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-orange-400/50 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-white/50 leading-relaxed">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {displayState.strengths.length > 0 && (
            <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.03] px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/60 mb-1.5">
                Strengths
              </p>
              <div className="space-y-1">
                {displayState.strengths.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400/50 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-white/50 leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      {displayState.opportunities.length > 0 && (
        <div className="mx-4 mb-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex w-full items-center justify-between mb-1.5"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Opportunities ({filteredOpportunities.length})
              </span>
            </div>
            {showFilters ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {/* Severity toggles */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setShowCritical(!showCritical)}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                      showCritical ? "border-red-400/30 bg-red-400/10 text-red-400" : "border-white/10 text-white/30"
                    }`}
                  >
                    Critical
                  </button>
                  <button
                    onClick={() => setShowHigh(!showHigh)}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                      showHigh ? "border-orange-400/30 bg-orange-400/10 text-orange-400" : "border-white/10 text-white/30"
                    }`}
                  >
                    High
                  </button>
                  <button
                    onClick={() => setShowMedium(!showMedium)}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                      showMedium ? "border-amber-400/30 bg-amber-400/10 text-amber-400" : "border-white/10 text-white/30"
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setShowLow(!showLow)}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                      showLow ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-white/10 text-white/30"
                    }`}
                  >
                    Low
                  </button>
                </div>
                {/* Category filter */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                      selectedCategory === "all" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400" : "border-white/10 text-white/30"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(categories).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                        selectedCategory === cat ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400" : "border-white/10 text-white/30"
                      }`}
                    >
                      {getCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Opportunity List ────────────────────────────────────────────── */}
      {displayState.opportunities.length > 0 && (
        <div className="mx-4 space-y-1.5">
          {filteredOpportunities.length === 0 ? (
            <p className="text-[11px] text-white/30 text-center py-3">
              No opportunities match the current filters.
            </p>
          ) : (
            filteredOpportunities.map((opp, i) => (
              <OpportunityCard key={opp.id ?? i} opportunity={opp} />
            ))
          )}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {displayState.opportunities.length === 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-400/10 bg-emerald-400/[0.03] px-3 py-4 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400 mb-1.5" />
          <p className="text-xs font-medium text-emerald-400/80">No issues detected</p>
          <p className="text-[10px] text-white/40 mt-0.5">
            The project is in good engineering health.
          </p>
        </div>
      )}

      {/* ── Bottom spacing ──────────────────────────────────────────────── */}
      <div className="h-2" />
    </div>
  );
}
