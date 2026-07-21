// ─── EngineeringCommandCenter — Unified Engineering Dashboard ────────────────
// Phase 15.2
//
// Aggregates every engineering intelligence system built during Phases 13–15
// into a single unified engineering operating system.
//
// Architecture:
//   wsRuntimeEmitter → EngineeringStore (1 subscriber)
//   EngineeringStore → EngineeringCommandCenter
//     ├─ Top: Health Score, Confidence, Phase, Progress
//     ├─ Middle: Timeline, Decision, Specialist, Tasks
//     ├─ Intelligence Grid (widgets from registry)
//     └─ Bottom: Recommendations, Issues, Opportunities, Learning
//
// Modes:
//   Compact  – Default, shows summaries
//   Expanded – Shows all engineering widgets in full
//   Focus    – Shows only currently active subsystem

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Code2,
  Eye,
  FileCode,
  Gauge,
  GitBranch,
  Globe,
  Hammer,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  Route,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wrench,
  XCircle,
  Zap,
  BookOpen,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  useEngineeringStore,
  type EngineeringStoreState,
} from "@/components/website-v2/ide/EngineeringStore";
import {
  widgetRegistry,
  getVisibleWidgets,
  getActiveWidgetIds,
  getWidgetSizeClass,
  type WidgetSize,
} from "@/components/website-v2/ide/EngineeringWidgetRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommandCenterMode = "compact" | "expanded" | "focus";

export interface CommandCenterTelemetry {
  renderTime: number;
  activeWidgets: number;
  collapsedWidgets: number;
  focusedWidget: string | null;
  healthScore: number;
  recommendationCount: number;
}

// ─── Health Score Computation ─────────────────────────────────────────────────

interface HealthInputs {
  confidenceScore: number;
  validationPassed: boolean;
  visualScore: number;
  recoveryStatus: string;
  auditScore: number;
  workspaceConsistency: number;
  learningConfidence: number;
}

function computeEngineeringHealth(inputs: HealthInputs): {
  score: number;
  label: string;
  color: string;
} {
  const {
    confidenceScore,
    validationPassed,
    visualScore,
    auditScore,
    workspaceConsistency,
    learningConfidence,
  } = inputs;

  // Weighted average
  const weights = {
    confidence: 0.25,
    validation: 0.15,
    visual: 0.15,
    audit: 0.15,
    workspace: 0.15,
    learning: 0.15,
  };

  let score =
    (confidenceScore * weights.confidence) +
    ((validationPassed ? 100 : 30) * weights.validation) +
    (visualScore * weights.visual) +
    (auditScore * weights.audit) +
    (workspaceConsistency * weights.workspace) +
    (learningConfidence * weights.learning);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: string;
  let color: string;
  if (score >= 90) { label = "Excellent"; color = "text-emerald-400"; }
  else if (score >= 75) { label = "Healthy"; color = "text-cyan-400"; }
  else if (score >= 50) { label = "Needs Attention"; color = "text-amber-400"; }
  else { label = "Critical"; color = "text-red-400"; }

  return { score, label, color };
}

function getHealthScoreColor(score: number): string {
  if (score >= 90) return "bg-emerald-400";
  if (score >= 75) return "bg-cyan-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

function extractHealthInputs(state: EngineeringStoreState): HealthInputs {
  return {
    confidenceScore: state.confidence?.score ?? 100,
    validationPassed: state.confidence?.validation?.typescript !== "failed",
    visualScore: state.visual?.score ?? 100,
    recoveryStatus: state.recovery?.eventType ?? "",
    auditScore: state.audit?.score ?? 100,
    workspaceConsistency: state.confidence?.breakdown?.workspaceConsistency ?? 100,
    learningConfidence: state.learning?.improvementScore ?? 50,
  };
}

// ─── Pipeline Stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "workspace",   label: "Workspace",   icon: Layers },
  { id: "planning",    label: "Planning",    icon: GitBranch },
  { id: "decision",    label: "Decision",    icon: Brain },
  { id: "specialists", label: "Specialists", icon: Code2 },
  { id: "execution",   label: "Execution",   icon: Zap },
  { id: "validation",  label: "Validation",  icon: ShieldCheck },
  { id: "visual",      label: "Visual",      icon: Eye },
  { id: "confidence",  label: "Confidence",  icon: Gauge },
  { id: "recovery",    label: "Recovery",    icon: RotateCcw },
  { id: "learning",    label: "Learning",    icon: TrendingUp },
  { id: "audit",       label: "Audit",       icon: ClipboardCheck },
] as const;

type PipelineStageId = typeof PIPELINE_STAGES[number]["id"];

function getCurrentStage(phase: string | null): PipelineStageId {
  if (!phase) return "workspace";
  const p = phase.toLowerCase();
  if (p.includes("plan") || p.includes("task")) return "planning";
  if (p.includes("decision")) return "decision";
  if (p.includes("specialist") || p.includes("rout")) return "specialists";
  if (p.includes("execut") || p.includes("edit") || p.includes("write")) return "execution";
  if (p.includes("valid") || p.includes("compil")) return "validation";
  if (p.includes("visual")) return "visual";
  if (p.includes("confiden")) return "confidence";
  if (p.includes("recover") || p.includes("rollback")) return "recovery";
  if (p.includes("learn")) return "learning";
  if (p.includes("audit")) return "audit";
  return "execution";
}

// ─── Merge Recommendations ────────────────────────────────────────────────────

function buildRecommendations(state: EngineeringStoreState): EngineeringStoreState["recommendations"] {
  const recs: EngineeringStoreState["recommendations"] = [];
  let idCounter = 0;
  const ts = Date.now();

  // From decision engine
  if (state.decision?.initialized && state.decision.recommendation) {
    const severityMap: Record<string, "info" | "warning" | "critical"> = {
      proceed: "info",
      "repair-first": "warning",
      "ask-user": "info",
      rollback: "critical",
      defer: "critical",
    };
    recs.push({
      id: `decision-${++idCounter}`,
      source: "decision",
      title: state.decision.recommendation === "proceed"
        ? "Decision: Proceed with execution"
        : `Decision: ${state.decision.recommendation.replace("-", " ")} — ${state.decision.chosenOption}`,
      severity: severityMap[state.decision.recommendation] ?? "info",
      priority: state.decision.recommendation === "defer" || state.decision.recommendation === "rollback" ? 90 : 50,
      timestamp: ts,
    });
  }

  // From audit
  if (state.audit?.initialized && state.audit.criticalCount > 0) {
    recs.push({
      id: `audit-critical-${++idCounter}`,
      source: "audit",
      title: `${state.audit.criticalCount} critical issue(s) found in engineering audit`,
      severity: "critical",
      priority: 85,
      timestamp: ts,
    });
  }

  // From confidence
  if (state.confidence?.initialized && state.confidence.score < 60) {
    recs.push({
      id: `confidence-low-${++idCounter}`,
      source: "confidence",
      title: `Low confidence (${state.confidence.score}%) — review risks before proceeding`,
      severity: "warning",
      priority: 75,
      timestamp: ts,
    });
  }

  // From visual
  if (state.visual?.initialized && state.visual.needsRepair) {
    recs.push({
      id: `visual-repair-${++idCounter}`,
      source: "confidence",
      title: `Visual verification needs repair (${state.visual.issues.length} issue(s))`,
      severity: "warning",
      priority: 70,
      timestamp: ts,
    });
  }

  // From recovery
  if (state.recovery?.initialized && state.recovery.lastRollbackSuccess === false) {
    recs.push({
      id: `recovery-failed-${++idCounter}`,
      source: "recovery",
      title: "Last rollback was not successful — manual intervention may be needed",
      severity: "critical",
      priority: 95,
      timestamp: ts,
    });
  }

  // From learning
  if (state.learning.improvementScore < 30 && state.learning.lastExecutionId) {
    recs.push({
      id: `learning-low-${++idCounter}`,
      source: "learning",
      title: `Learning improvement score is low (${state.learning.improvementScore}) — execution patterns may need adjustment`,
      severity: "warning",
      priority: 40,
      timestamp: ts,
    });
  }

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 20);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated health score ring. */
function HealthScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = getHealthScoreColor(score);
  const { label, color: labelColor } = (() => {
    if (score >= 90) return { label: "Excellent", color: "text-emerald-400" };
    if (score >= 75) return { label: "Healthy", color: "text-cyan-400" };
    if (score >= 50) return { label: "Needs Attention", color: "text-amber-400" };
    return { label: "Critical", color: "text-red-400" };
  })();

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
            className="text-white/10" />
          <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round"
            className={color}
            strokeDasharray={Math.PI * 31}
            initial={{ strokeDashoffset: Math.PI * 31 }}
            animate={{ strokeDashoffset: Math.PI * 31 * (1 - clamped / 100) }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${labelColor}`}>{clamped}</span>
        </div>
      </div>
      <div>
        <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
        <p className="text-[9px] text-white/40 uppercase tracking-wider">Engineering Health</p>
      </div>
    </div>
  );
}

/** Pipeline flow visualization. */
function PipelineFlow({ currentStage }: { currentStage: PipelineStageId }) {
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-none">
      {PIPELINE_STAGES.map((stage, i) => {
        const isCompleted = i < stageIndex;
        const isCurrent = i === stageIndex;
        const isUpcoming = i > stageIndex;
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="flex items-center gap-0.5 shrink-0">
            <div
              className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-all ${
                isCurrent
                  ? "bg-cyan-400/15 border border-cyan-400/30"
                  : isCompleted
                  ? "bg-emerald-400/10 border border-emerald-400/20"
                  : "bg-white/[0.02] border border-white/5"
              }`}
            >
              <Icon className={`h-3 w-3 ${
                isCurrent ? "text-cyan-400" : isCompleted ? "text-emerald-400/70" : "text-white/20"
              }`} />
              <span className={`text-[8px] font-medium leading-tight whitespace-nowrap ${
                isCurrent ? "text-cyan-300" : isCompleted ? "text-emerald-400/60" : "text-white/25"
              }`}>
                {stage.label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className={`h-2.5 w-2.5 ${
                isCompleted ? "text-emerald-400/40" : "text-white/10"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Merged recommendation item. */
function RecommendationItem({ rec }: { rec: EngineeringStoreState["recommendations"][0] }) {
  const iconMap = {
    audit: ClipboardCheck,
    decision: Brain,
    confidence: Shield,
    recovery: RotateCcw,
    learning: TrendingUp,
  } as const;
  const Icon = iconMap[rec.source] ?? Lightbulb;

  const severityColors = {
    info: "border-cyan-400/10 bg-cyan-400/[0.03]",
    warning: "border-amber-400/10 bg-amber-400/[0.03]",
    critical: "border-red-400/10 bg-red-400/[0.03]",
  };

  const severityTextColors = {
    info: "text-cyan-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  };

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${severityColors[rec.severity]}`}>
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${severityTextColors[rec.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-white/70 leading-relaxed">{rec.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[8px] font-medium uppercase tracking-wider ${severityTextColors[rec.severity]}`}>
            {rec.severity}
          </span>
          <span className="text-[8px] text-white/25">{rec.source}</span>
        </div>
      </div>
    </div>
  );
}

/** Mode toggle button. */
function ModeButton({
  mode,
  current,
  onSelect,
  icon: Icon,
  label,
}: {
  mode: CommandCenterMode;
  current: CommandCenterMode;
  onSelect: (m: CommandCenterMode) => void;
  icon: React.ElementType;
  label: string;
}) {
  const isActive = mode === current;
  return (
    <button
      onClick={() => onSelect(mode)}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium transition-all ${
        isActive
          ? "bg-cyan-400/15 text-cyan-400 border border-cyan-400/30"
          : "text-white/40 hover:text-white/60 border border-transparent"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EngineeringCommandCenterProps {
  /** Override mode (e.g., from parent state). */
  mode?: CommandCenterMode;
  /** Callback when mode changes. */
  onModeChange?: (mode: CommandCenterMode) => void;
  /** Telemetry callback. */
  onTelemetry?: (t: CommandCenterTelemetry) => void;
}

export function EngineeringCommandCenter({
  mode: externalMode,
  onModeChange,
  onTelemetry,
}: EngineeringCommandCenterProps) {
  const renderStartTime = useMemo(() => Date.now(), []);
  const storeState = useEngineeringStore();

  // Internal mode state (if no external mode provided)
  const [internalMode, setInternalMode] = useState<CommandCenterMode>("compact");
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);

  const mode = externalMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;

  // Collapsible sections
  const [showPipeline, setShowPipeline] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showActivity, setShowActivity] = useState(false);

  // Compute health
  const healthInputs = useMemo(() => extractHealthInputs(storeState), [storeState]);
  const health = useMemo(() => computeEngineeringHealth(healthInputs), [healthInputs]);

  // Get current pipeline stage
  const currentStage = useMemo(() => getCurrentStage(storeState.phase), [storeState.phase]);

  // Build recommendations
  const recommendations = useMemo(
    () => buildRecommendations(storeState),
    [storeState.decision, storeState.audit, storeState.confidence, storeState.visual, storeState.recovery, storeState.learning],
  );

  // Get visible widgets
  const visibleWidgets = useMemo(
    () => getVisibleWidgets(storeState, mode === "focus" ? focusedWidget : null),
    [storeState, mode, focusedWidget],
  );

  const activeWidgetIds = useMemo(() => getActiveWidgetIds(storeState), [storeState]);

  // Telemetry on mount
  useEffect(() => {
    if (!onTelemetry) return;
    const timeout = setTimeout(() => {
      onTelemetry({
        renderTime: Date.now() - renderStartTime,
        activeWidgets: visibleWidgets.length,
        collapsedWidgets: widgetRegistry.length - visibleWidgets.length,
        focusedWidget,
        healthScore: health.score,
        recommendationCount: recommendations.length,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [onTelemetry, renderStartTime, visibleWidgets.length, focusedWidget, health.score, recommendations.length]);

  // ── Compact mode: summary view ──────────────────────────────────────────
  if (mode === "compact") {
    return (
      <div className="select-none">
        {/* ── Top: Health + Phase + Quick Stats ──────────────────────────── */}
        <div className="mx-4 mb-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <HealthScoreRing score={health.score} />
                <div className="border-l border-white/10 pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Activity className="h-3 w-3 text-cyan-400" />
                    <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                      {storeState.phase ?? "Idle"}
                    </span>
                  </div>
                  {storeState.isRunning && (
                    <div className="flex items-center gap-3 text-[9px] text-white/40">
                      <span>{storeState.timeline?.steps?.length ?? 0} steps</span>
                      {storeState.timeline?.totalDurationMs && (
                        <span>{(storeState.timeline.totalDurationMs / 1000).toFixed(1)}s</span>
                      )}
                      {storeState.confidence && (
                        <span className={storeState.confidence.score >= 70 ? "text-emerald-400/70" : "text-amber-400/70"}>
                          {storeState.confidence.level}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Mode switcher */}
              <div className="flex items-center gap-1">
                <ModeButton mode="compact" current={mode} onSelect={setMode} icon={Minimize2} label="Compact" />
                <ModeButton mode="expanded" current={mode} onSelect={setMode} icon={Maximize2} label="Expanded" />
              </div>
            </div>

            {/* Pipeline flow (collapsible) */}
            {storeState.isRunning && (
              <>
                <button
                  onClick={() => setShowPipeline(!showPipeline)}
                  className="flex items-center gap-1.5 w-full mb-1"
                >
                  <GitBranch className="h-3 w-3 text-white/30" />
                  <span className="text-[8px] font-medium uppercase tracking-wider text-white/30">Pipeline</span>
                  {showPipeline ? <ChevronUp className="h-3 w-3 text-white/20 ml-auto" /> : <ChevronDown className="h-3 w-3 text-white/20 ml-auto" />}
                </button>
                <AnimatePresence>
                  {showPipeline && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <PipelineFlow currentStage={currentStage} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>

        {/* ── Quick Recommendations ──────────────────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="mx-4 mb-3">
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="flex items-center gap-1.5 w-full mb-1.5"
            >
              <Lightbulb className="h-3 w-3 text-amber-400" />
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">
                Recommendations ({recommendations.length})
              </span>
              {showRecommendations ? <ChevronUp className="h-3 w-3 text-white/20 ml-auto" /> : <ChevronDown className="h-3 w-3 text-white/20 ml-auto" />}
            </button>
            <AnimatePresence>
              {showRecommendations && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1 overflow-hidden"
                >
                  {recommendations.slice(0, 3).map((rec) => (
                    <RecommendationItem key={rec.id} rec={rec} />
                  ))}
                  {recommendations.length > 3 && (
                    <p className="text-[9px] text-white/25 text-center pt-1">
                      +{recommendations.length - 3} more
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Bottom spacing ─────────────────────────────────────────────── */}
        <div className="h-2" />
      </div>
    );
  }

  // ── Expanded / Focus mode: full dashboard ───────────────────────────────
  return (
    <div className="select-none">
      {/* ── Header with mode switcher ────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white/80">Command Center</span>
        </div>
        <div className="flex items-center gap-1">
          <ModeButton mode="compact" current={mode} onSelect={setMode} icon={Minimize2} label="Compact" />
          <ModeButton mode="expanded" current={mode} onSelect={setMode} icon={Maximize2} label="Expanded" />
          <ModeButton mode="focus" current={mode} onSelect={(m) => { setMode(m); if (m !== "focus") setFocusedWidget(null); }} icon={Target} label="Focus" />
        </div>
      </div>

      {/* ── Top Section: Health + Phase + Progress ───────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <HealthScoreRing score={health.score} />
            <div className="flex items-center gap-4 text-xs text-white/50">
              <div className="text-center">
                <ShieldCheck className={`h-4 w-4 mx-auto mb-0.5 ${
                  storeState.confidence?.score >= 70 ? "text-emerald-400" : "text-amber-400"
                }`} />
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Confidence</span>
                <p className={`text-xs font-bold ${
                  storeState.confidence?.score >= 70 ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {storeState.confidence?.score ?? "-"}%
                </p>
              </div>
              <div className="text-center">
                <Eye className={`h-4 w-4 mx-auto mb-0.5 ${
                  storeState.visual?.score >= 70 ? "text-emerald-400" : storeState.visual?.score >= 50 ? "text-amber-400" : "text-red-400"
                }`} />
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Visual</span>
                <p className={`text-xs font-bold ${
                  storeState.visual?.score >= 70 ? "text-emerald-400" : storeState.visual?.score >= 50 ? "text-amber-400" : "text-red-400"
                }`}>
                  {storeState.visual?.score ?? "-"}
                </p>
              </div>
              <div className="text-center">
                <ClipboardCheck className={`h-4 w-4 mx-auto mb-0.5 ${
                  storeState.audit?.score >= 75 ? "text-emerald-400" : storeState.audit?.score >= 50 ? "text-amber-400" : "text-red-400"
                }`} />
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Audit</span>
                <p className={`text-xs font-bold ${
                  storeState.audit?.score >= 75 ? "text-emerald-400" : storeState.audit?.score >= 50 ? "text-amber-400" : "text-red-400"
                }`}>
                  {storeState.audit?.score ?? "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Phase & progress */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                {storeState.phase ?? "Idle"}
              </span>
            </div>
            {storeState.timeline?.steps && (
              <span className="text-[9px] text-white/30">
                Step {storeState.timeline.steps.filter((s) => s.status === "completed").length}/{storeState.timeline.steps.length}
              </span>
            )}
          </div>

          {/* Pipeline flow */}
          {storeState.isRunning && (
            <PipelineFlow currentStage={currentStage} />
          )}
        </div>
      </div>

      {/* ── Focus mode: widget selector ──────────────────────────────────── */}
      {mode === "focus" && (
        <div className="mx-4 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFocusedWidget(null)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                focusedWidget === null ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400" : "border-white/10 text-white/30"
              }`}
            >
              All Active
            </button>
            {widgetRegistry.map((w) => (
              <button
                key={w.id}
                onClick={() => setFocusedWidget(w.id)}
                className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                  focusedWidget === w.id ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400" : "border-white/10 text-white/30"
                }`}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommendations Section ──────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="flex items-center gap-1.5 w-full mb-1.5"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              Recommendations ({recommendations.length})
            </span>
            {showRecommendations ? <ChevronUp className="h-3.5 w-3.5 text-white/30 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30 ml-auto" />}
          </button>
          <AnimatePresence>
            {showRecommendations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                {recommendations.map((rec) => (
                  <RecommendationItem key={rec.id} rec={rec} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Intelligence Widget Grid ─────────────────────────────────────── */}
      {visibleWidgets.length > 0 ? (
        <div className="mx-4 space-y-1">
          {visibleWidgets.map((widget) => (
            <div
              key={widget.id}
              className="rounded-lg border border-white/5 bg-white/[0.01] overflow-hidden"
            >
              {widget.render(storeState, mode === "expanded" ? false : true)}
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-4 mb-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-4 text-center">
          <Gauge className="mx-auto h-5 w-5 text-white/20 mb-1.5" />
          <p className="text-xs font-medium text-white/40">No active engineering subsystems</p>
          <p className="text-[10px] text-white/25 mt-0.5">
            Engineering panels will appear here during project editing.
          </p>
        </div>
      )}

      {/* ── Bottom spacing ──────────────────────────────────────────────── */}
      <div className="h-2" />
    </div>
  );
}
