// ─── EngineeringVisualPanel — Autonomous Visual Verification UI ──────────────
// Phase 14.4
//
// Displays live visual QA results — layout analysis, responsive checks, design
// token compliance, and before/after comparison — during Website Studio editing.
// Updates from SSE events. Complements EngineeringConfidencePanel.
//
// Architecture:
//   Visual Verification Engine → SSE → EngineeringVisualPanel
//                                     → Live Visual Score Updates
//                                     → Execution Complete (persistent summary)

import { useEffect, useReducer, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Layout,
  Smartphone,
  Type,
  Palette,
  Image,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileCode,
  GitBranch,
  BarChart3,
  Wrench,
  Monitor,
  Tablet,
  Maximize2,
  Grid3X3,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type {
  WSVisualUpdate,
  WSVisualStatus,
  WSVisualIssue,
  WSVisualIssueCategory,
  WSVisualIssueSeverity,
  WSVisualScoreBreakdown,
  WSVisualComparison,
} from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisualPanelState {
  /** Overall visual score 0–100 */
  score: number;
  /** Visual status */
  status: WSVisualStatus;
  /** Detected visual issues */
  issues: WSVisualIssue[];
  /** Before/after comparison */
  comparison: WSVisualComparison;
  /** Score breakdown by category */
  breakdown: WSVisualScoreBreakdown;
  /** Whether repair is needed */
  needsRepair: boolean;
  /** Number of auto-repair attempts */
  repairAttempts: number;
  /** Human-readable summary */
  summary: string;
  /** When the snapshot was computed */
  timestamp: string | null;
  /** Whether the panel has received at least one update */
  initialized: boolean;
}

type VisualAction =
  | { type: "UPDATE"; payload: WSVisualUpdate }
  | { type: "RESET" };

function visualReducer(state: VisualPanelState, action: VisualAction): VisualPanelState {
  switch (action.type) {
    case "UPDATE":
      return {
        ...state,
        score: action.payload.score,
        status: action.payload.status,
        issues: action.payload.issues,
        comparison: action.payload.comparison,
        breakdown: action.payload.breakdown,
        needsRepair: action.payload.needsRepair,
        repairAttempts: action.payload.repairAttempts,
        summary: action.payload.summary,
        timestamp: action.payload.timestamp,
        initialized: true,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: VisualPanelState = {
  score: 100,
  status: "healthy",
  issues: [],
  comparison: { modifiedVisuals: [], removedFiles: [], addedFiles: [], sectionDelta: 0 },
  breakdown: {
    layoutScore: 100,
    overlapScore: 100,
    spacingScore: 100,
    responsiveScore: 100,
    typographyScore: 100,
    designTokenScore: 100,
    regressionScore: 100,
  },
  needsRepair: false,
  repairAttempts: 0,
  summary: "",
  timestamp: null,
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

function getStatusColor(status: WSVisualStatus): string {
  switch (status) {
    case "healthy":  return "text-emerald-400";
    case "warning":  return "text-amber-400";
    case "failed":   return "text-red-400";
    case "critical": return "text-red-400 animate-pulse";
  }
}

function getStatusBg(status: WSVisualStatus): string {
  switch (status) {
    case "healthy":  return "bg-emerald-400/10 border-emerald-400/20";
    case "warning":  return "bg-amber-400/10 border-amber-400/20";
    case "failed":   return "bg-red-400/10 border-red-400/20";
    case "critical": return "bg-red-500/15 border-red-500/30";
  }
}

function getIssueCategoryIcon(category: WSVisualIssueCategory): React.ElementType {
  switch (category) {
    case "layout-break":             return Layout;
    case "overlap":                  return Maximize2;
    case "missing-section":          return Image;
    case "spacing":                  return Grid3X3;
    case "responsive":               return Smartphone;
    case "typography":               return Type;
    case "design-token":             return Palette;
    case "before-after-regression":  return GitBranch;
  }
}

function getIssueCategoryLabel(category: WSVisualIssueCategory): string {
  switch (category) {
    case "layout-break":             return "Layout";
    case "overlap":                  return "Overlap";
    case "missing-section":          return "Missing Section";
    case "spacing":                  return "Spacing";
    case "responsive":               return "Responsive";
    case "typography":               return "Typography";
    case "design-token":             return "Design Token";
    case "before-after-regression":  return "Regression";
  }
}

function getIssueSeverityColor(severity: WSVisualIssueSeverity): string {
  switch (severity) {
    case "critical": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "high":     return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "medium":   return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "low":      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Animated score meter bar */
function ScoreMeter({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className="w-full">
      <div className={`w-full overflow-hidden rounded-full bg-white/5 ${barHeight}`}>
        <motion.div
          className={`h-full rounded-full ${getScoreBg(clampedScore)}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/** Visual stat card */
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-lg border border-[#303030] bg-[#1E1E1E] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
    </div>
  );
}

/** Breakdown dimension bar */
function BreakdownBar({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-white/40" />
          <span className="text-[11px] text-white/60">{label}</span>
        </div>
        <span className={`text-[11px] font-medium ${getScoreColor(clampedScore)}`}>{Math.round(clampedScore)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full ${getScoreBg(clampedScore)}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/** Visual issue item */
function VisualIssueItem({ issue }: { issue: WSVisualIssue }) {
  const Icon = getIssueCategoryIcon(issue.category);

  return (
    <div className={`rounded-lg border px-3 py-2 ${getIssueSeverityColor(issue.severity)}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              {getIssueCategoryLabel(issue.category)}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider">
              {issue.severity}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/80 leading-relaxed">{issue.description}</p>
          {issue.suggestion && (
            <p className="mt-0.5 text-[10px] text-white/40 italic">Suggestion: {issue.suggestion}</p>
          )}
          {issue.affectedFiles.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.affectedFiles.map((f, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 truncate max-w-[180px]">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Before/after comparison row */
function ComparisonRow({ file, reason }: { file: string; reason: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <GitBranch className="h-3 w-3 text-cyan-400 shrink-0" />
      <span className="flex-1 text-[11px] text-white/70 truncate">{file}</span>
      <span className="text-[10px] text-white/40 shrink-0">{reason}</span>
    </div>
  );
}

// ─── EngineeringVisualPanel Component ─────────────────────────────────────────

interface EngineeringVisualPanelProps {
  /** Optional external state override */
  externalState?: VisualPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringVisualPanel({ externalState, compact = false }: EngineeringVisualPanelProps) {
  const [state, dispatch] = useReducer(visualReducer, initialState);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showIssues, setShowIssues] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const renderStartRef = useRef(0);

  // Track render
  useEffect(() => {
    renderStartRef.current = 0;
  });

  // Subscribe to visual verification events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      renderStartRef.current = Date.now();

      if (event.type === "VisualUpdate") {
        const update = event.payload as unknown as WSVisualUpdate;
        dispatch({ type: "UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  if (!displayState.initialized && !externalState) return null;

  const highSeverityCount = displayState.issues.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  ).length;

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white/80">Visual Verification</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
        </div>
      </div>

      {/* ── Visual Score ────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <span className={`text-3xl font-bold tracking-tight ${getScoreColor(displayState.score)}`}>
              {displayState.score}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${getStatusColor(displayState.status)}`}>
              {displayState.status}
            </span>
          </div>
        </div>
        <ScoreMeter score={displayState.score} />
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <StatCard
          label="Issues"
          value={displayState.issues.length}
          icon={AlertTriangle}
          color={highSeverityCount > 0 ? "text-red-400" : "text-emerald-400"}
        />
        <StatCard
          label="High/Critical"
          value={highSeverityCount}
          icon={XCircle}
          color={highSeverityCount > 0 ? "text-red-400" : "text-emerald-400"}
        />
        <StatCard
          label="Layout Breaks"
          value={displayState.issues.filter((i) => i.category === "layout-break").length}
          icon={Layout}
          color="text-purple-400"
        />
        <StatCard
          label="Responsive"
          value={displayState.issues.filter((i) => i.category === "responsive").length}
          icon={Smartphone}
          color="text-cyan-400"
        />
      </div>

      {/* ── Score Breakdown ─────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="mb-2 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Breakdown</span>
          </div>
          {showBreakdown ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
        </button>
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] p-3"
            >
              <BreakdownBar label="Layout" score={displayState.breakdown.layoutScore} icon={Layout} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Overlap" score={displayState.breakdown.overlapScore} icon={Maximize2} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Spacing" score={displayState.breakdown.spacingScore} icon={Grid3X3} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Responsive" score={displayState.breakdown.responsiveScore} icon={Smartphone} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Typography" score={displayState.breakdown.typographyScore} icon={Type} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Design Token" score={displayState.breakdown.designTokenScore} icon={Palette} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Regression" score={displayState.breakdown.regressionScore} icon={GitBranch} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Detected Issues ─────────────────────────────────────────────── */}
      {displayState.issues.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Issues ({displayState.issues.length})
              </span>
            </div>
            {showIssues ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showIssues && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                {displayState.issues.map((issue, i) => (
                  <VisualIssueItem key={i} issue={issue} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {displayState.summary && (
        <div className="mx-4 mb-3">
          <div className={`rounded-lg border px-3 py-2 ${getStatusBg(displayState.status)}`}>
            <p className="text-[11px] text-white/70 leading-relaxed">{displayState.summary}</p>
          </div>
        </div>
      )}

      {/* ── Before/After Comparison ─────────────────────────────────────── */}
      {(displayState.comparison.modifiedVisuals.length > 0 ||
        displayState.comparison.removedFiles.length > 0 ||
        displayState.comparison.addedFiles.length > 0) && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Comparison ({displayState.comparison.modifiedVisuals.length + displayState.comparison.removedFiles.length + displayState.comparison.addedFiles.length} changes)
              </span>
            </div>
            {showComparison ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-1"
              >
                {displayState.comparison.addedFiles.length > 0 && (
                  <div className="py-1.5">
                    <span className="text-[10px] font-medium text-emerald-400/80">+ Added ({displayState.comparison.addedFiles.length})</span>
                    {displayState.comparison.addedFiles.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                        <FileCode className="h-2.5 w-2.5 text-emerald-400/60" />
                        <span className="text-[10px] text-white/50">{f}</span>
                      </div>
                    ))}
                    {displayState.comparison.addedFiles.length > 5 && (
                      <span className="text-[9px] text-white/30 pl-4">+{displayState.comparison.addedFiles.length - 5} more</span>
                    )}
                  </div>
                )}
                {displayState.comparison.removedFiles.length > 0 && (
                  <div className="py-1.5 border-t border-white/5">
                    <span className="text-[10px] font-medium text-red-400/80">− Removed ({displayState.comparison.removedFiles.length})</span>
                    {displayState.comparison.removedFiles.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                        <XCircle className="h-2.5 w-2.5 text-red-400/60" />
                        <span className="text-[10px] text-white/50">{f}</span>
                      </div>
                    ))}
                    {displayState.comparison.removedFiles.length > 5 && (
                      <span className="text-[9px] text-white/30 pl-4">+{displayState.comparison.removedFiles.length - 5} more</span>
                    )}
                  </div>
                )}
                {displayState.comparison.modifiedVisuals.length > 0 && (
                  <div className="py-1.5 border-t border-white/5">
                    <span className="text-[10px] font-medium text-amber-400/80">Modified ({displayState.comparison.modifiedVisuals.length})</span>
                    {displayState.comparison.modifiedVisuals.slice(0, 5).map((mv, i) => (
                      <ComparisonRow key={i} file={mv.path} reason={mv.reason} />
                    ))}
                    {displayState.comparison.modifiedVisuals.length > 5 && (
                      <span className="text-[9px] text-white/30 pl-4">+{displayState.comparison.modifiedVisuals.length - 5} more</span>
                    )}
                  </div>
                )}
                {displayState.comparison.sectionDelta !== 0 && (
                  <div className="py-1.5 border-t border-white/5">
                    <span className="text-[10px] text-white/40">
                      Section delta: {displayState.comparison.sectionDelta > 0 ? "+" : ""}{displayState.comparison.sectionDelta}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Auto-Repair Status ──────────────────────────────────────────── */}
      {displayState.repairAttempts > 0 && (
        <div className="mx-4 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
            <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300/70">
              Auto-repair: {displayState.repairAttempts} attempt{displayState.repairAttempts !== 1 ? "s" : ""}
              {displayState.needsRepair ? " — still needs attention" : " — issues resolved"}
            </span>
            {!displayState.needsRepair && (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
            )}
          </div>
        </div>
      )}

      {/* ── Bottom spacing ──────────────────────────────────────────────── */}
      <div className="h-2" />
    </div>
  );
}
