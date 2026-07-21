// ─── EngineeringConfidencePanel — Confidence & Risk Intelligence UI ──────────
// Phase 14.2
//
// Displays live confidence, risk, impact, validation health, and repair history
// during Website Studio editing. Updates from SSE events. Complements the
// Engineering Timeline — does not replace it.
//
// Architecture:
//   Confidence Engine → SSE → EngineeringConfidencePanel
//                           → Live Confidence Updates
//                           → Execution Complete (persistent summary)

import { useEffect, useReducer, useRef, useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  FileCode,
  Layers,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Wrench,
  Eye,
  Bug,
  Palette,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSConfidenceUpdate, WSConfidenceLevel, WSValidatorStatus } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSPreviewUpdate, WSPreviewStatus } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfidencePanelState {
  /** Overall confidence score 0–100 */
  score: number;
  /** Confidence level */
  level: WSConfidenceLevel;
  /** Detected risks */
  risks: WSConfidenceUpdate["risks"];
  /** Impact analysis */
  impact: WSConfidenceUpdate["impact"];
  /** Validation health */
  validation: WSConfidenceUpdate["validation"];
  /** Confidence signal breakdown */
  breakdown: WSConfidenceUpdate["breakdown"];
  /** Repair history */
  repairs: WSConfidenceUpdate["repairs"];
  /** When the confidence snapshot was computed */
  timestamp: string | null;
  /** Whether the panel has received at least one update */
  initialized: boolean;
  /** Phase 14.3: Preview intelligence state */
  preview: {
    status: WSPreviewStatus;
    healthScore: number;
    runtimeErrors: string[];
    visualIssues: WSPreviewUpdate["visualIssues"];
    repairAttempts: number;
  };
}

type ConfidenceAction =
  | { type: "UPDATE"; payload: WSConfidenceUpdate }
  | { type: "PREVIEW_UPDATE"; payload: WSPreviewUpdate }
  | { type: "RESET" };

function confidenceReducer(state: ConfidencePanelState, action: ConfidenceAction): ConfidencePanelState {
  switch (action.type) {
    case "UPDATE":
      return {
        ...state,
        score: action.payload.score,
        level: action.payload.level,
        risks: action.payload.risks,
        impact: action.payload.impact,
        validation: action.payload.validation,
        breakdown: action.payload.breakdown,
        repairs: action.payload.repairs,
        timestamp: action.payload.timestamp,
        initialized: true,
      };
    case "PREVIEW_UPDATE":
      return {
        ...state,
        preview: {
          status: action.payload.status,
          healthScore: action.payload.healthScore,
          runtimeErrors: action.payload.runtimeErrors,
          visualIssues: action.payload.visualIssues,
          repairAttempts: action.payload.repairAttempts,
        },
        initialized: true,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: ConfidencePanelState = {
  score: 0,
  level: "medium",
  risks: [],
  impact: { score: 0, affectedFiles: 0, affectedComponents: 0, affectedRoutes: 0, dependenciesTouched: 0 },
  validation: { typescript: "pending", eslint: "pending", build: "pending" },
  breakdown: { planningQuality: 0, validationScore: 0, workspaceConsistency: 0, historicalSuccess: 0, specialistConfidence: 0, repairStability: 0 },
  repairs: [],
  timestamp: null,
  initialized: false,
  preview: {
    status: "healthy",
    healthScore: 100,
    runtimeErrors: [],
    visualIssues: [],
    repairAttempts: 0,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConfidenceColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getConfidenceBg(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

function getStatusColor(status: WSValidatorStatus): string {
  switch (status) {
    case "passed":   return "text-emerald-400";
    case "running":  return "text-amber-400";
    case "failed":   return "text-red-400";
    case "pending":  return "text-white/20";
  }
}

function getStatusIcon(status: WSValidatorStatus) {
  switch (status) {
    case "passed":   return CheckCircle;
    case "running":  return RefreshCw;
    case "failed":   return XCircle;
    case "pending":  return Clock;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "high":     return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "medium":   return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "low":      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    default:         return "text-white/50 bg-white/5 border-white/10";
  }
}

function getLevelLabel(level: WSConfidenceLevel): string {
  switch (level) {
    case "high":   return "HIGH CONFIDENCE";
    case "medium": return "MEDIUM CONFIDENCE";
    case "low":    return "LOW CONFIDENCE";
  }
}

function getLevelColor(level: WSConfidenceLevel): string {
  switch (level) {
    case "high":   return "text-emerald-400";
    case "medium": return "text-amber-400";
    case "low":    return "text-red-400";
  }
}

function getPreviewStatusColor(status: WSPreviewStatus): string {
  switch (status) {
    case "healthy": return "text-emerald-400";
    case "warning": return "text-amber-400";
    case "failed":  return "text-red-400";
  }
}

function getPreviewStatusBg(status: WSPreviewStatus): string {
  switch (status) {
    case "healthy": return "bg-emerald-400/10 border-emerald-400/20";
    case "warning": return "bg-amber-400/10 border-amber-400/20";
    case "failed":  return "bg-red-400/10 border-red-400/20";
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

interface ConfidenceTelemetry {
  renderCount: number;
  updateLatencyMs: number[];
  riskPanelInteractions: number;
  expandedBreakdowns: number;
  validatorStatusUpdates: number;
  repairHistoryUpdates: number;
}

function createConfidenceTelemetry(): ConfidenceTelemetry {
  return {
    renderCount: 0,
    updateLatencyMs: [],
    riskPanelInteractions: 0,
    expandedBreakdowns: 0,
    validatorStatusUpdates: 0,
    repairHistoryUpdates: 0,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated confidence meter bar */
function ConfidenceMeter({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const barHeight = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className="w-full">
      <div className={`w-full overflow-hidden rounded-full bg-white/5 ${barHeight}`}>
        <motion.div
          className={`h-full rounded-full ${getConfidenceBg(clampedScore)}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/** Animated stat card */
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

/** Validator status row */
function ValidatorRow({ name, status }: { name: string; status: WSValidatorStatus }) {
  const StatusIcon = getStatusIcon(status);
  const isSpinning = status === "running";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-white/60">{name}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-medium capitalize ${getStatusColor(status)}`}>{status}</span>
        <StatusIcon className={`h-3.5 w-3.5 ${getStatusColor(status)} ${isSpinning ? "animate-spin" : ""}`} />
      </div>
    </div>
  );
}

/** Risk item */
function RiskItem({ severity, reason, affectedScope }: { severity: string; reason: string; affectedScope?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${getSeverityColor(severity)}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium">{reason}</p>
          {affectedScope && (
            <p className="mt-0.5 text-[10px] text-white/40 truncate">{affectedScope}</p>
          )}
        </div>
        <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wider">{severity}</span>
      </div>
    </div>
  );
}

/** Breakdown bar */
function BreakdownBar({ label, score }: { label: string; score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className={`text-[11px] font-medium ${getConfidenceColor(clampedScore)}`}>{Math.round(clampedScore)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full ${getConfidenceBg(clampedScore)}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/** Repair history item */
function RepairItem({ attempt, validator, status }: { attempt: number; validator: string; status: "fixed" | "failed" }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[10px] font-medium text-white/40 w-20">Attempt {attempt}</span>
      <span className="flex-1 text-xs text-white/70">{validator}</span>
      {status === "fixed" ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-400" />
      )}
      <span className={`text-[10px] font-medium ${status === "fixed" ? "text-emerald-400" : "text-red-400"}`}>
        {status === "fixed" ? "Fixed" : "Failed"}
      </span>
    </div>
  );
}

// ─── EngineeringConfidencePanel Component ─────────────────────────────────────

interface EngineeringConfidencePanelProps {
  /** Optional external state override */
  externalState?: ConfidencePanelState | null;
  /** Optional telemetry callback */
  onTelemetry?: (t: ConfidenceTelemetry) => void;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringConfidencePanel({ externalState, onTelemetry, compact = false }: EngineeringConfidencePanelProps) {
  const [state, dispatch] = useReducer(confidenceReducer, initialState);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showRisks, setShowRisks] = useState(true);
  const [showRepairs, setShowRepairs] = useState(true);
  const [telemetry] = useState(createConfidenceTelemetry);
  const renderStartRef = useRef(0);
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  // Track render for telemetry
  useEffect(() => {
    telemetry.renderCount++;
    if (renderStartRef.current > 0) {
      const latency = Date.now() - renderStartRef.current;
      telemetry.updateLatencyMs.push(latency);
    }
    renderStartRef.current = 0;
  });

  // Subscribe to confidence & preview events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      renderStartRef.current = Date.now();

      if (event.type === "ConfidenceUpdate") {
        const update = event.payload as unknown as WSConfidenceUpdate;
        dispatch({ type: "UPDATE", payload: update });
      } else if (event.type === "PreviewUpdate") {
        const update = event.payload as unknown as WSPreviewUpdate;
        dispatch({ type: "PREVIEW_UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  // Report telemetry on completion
  useEffect(() => {
    if (displayState.initialized) {
      onTelemetry?.(telemetryRef.current);
    }
  }, [displayState.initialized, onTelemetry]);

  // Track validator status changes for telemetry
  const prevValidationRef = useRef(displayState.validation);
  useEffect(() => {
    const prev = prevValidationRef.current;
    if (prev.typescript !== displayState.validation.typescript ||
        prev.eslint !== displayState.validation.eslint ||
        prev.build !== displayState.validation.build) {
      telemetry.validatorStatusUpdates++;
    }
    prevValidationRef.current = displayState.validation;
  }, [displayState.validation]);

  // Track repair changes
  const prevRepairsCount = useRef(displayState.repairs.length);
  useEffect(() => {
    if (displayState.repairs.length > prevRepairsCount.current) {
      telemetry.repairHistoryUpdates += displayState.repairs.length - prevRepairsCount.current;
    }
    prevRepairsCount.current = displayState.repairs.length;
  }, [displayState.repairs.length]);

  // Track interactions
  const trackBreakdownToggle = useCallback(() => {
    telemetry.riskPanelInteractions++;
  }, []);

  const trackRiskToggle = useCallback(() => {
    telemetry.riskPanelInteractions++;
  }, []);

  if (!displayState.initialized && !externalState) return null;

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-white/80">Engineering Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
        </div>
      </div>

      {/* ── Confidence Score ────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <span className={`text-3xl font-bold tracking-tight ${getConfidenceColor(displayState.score)}`}>
              {displayState.score}%
            </span>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${getLevelColor(displayState.level)}`}>
            {getLevelLabel(displayState.level)}
          </span>
        </div>
        <ConfidenceMeter score={displayState.score} />
      </div>

      {/* ── Impact Stats ────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <StatCard label="Impact" value={displayState.impact.score} icon={Activity} color="text-amber-400" />
        <StatCard label="Files" value={displayState.impact.affectedFiles} icon={FileCode} color="text-blue-400" />
        <StatCard label="Components" value={displayState.impact.affectedComponents} icon={Layers} color="text-purple-400" />
        <StatCard label="Routes" value={displayState.impact.affectedRoutes} icon={GitBranch} color="text-cyan-400" />
      </div>

      {/* ── Validation Health ───────────────────────────────────────────── */}
      <div className="mx-4 mb-3 rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2">
        <div className="mb-1 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Validation</span>
        </div>
        <ValidatorRow name="TypeScript" status={displayState.validation.typescript} />
        <div className="border-t border-white/5" />
        <ValidatorRow name="ESLint" status={displayState.validation.eslint} />
        <div className="border-t border-white/5" />
        <ValidatorRow name="Build" status={displayState.validation.build} />
        {displayState.validation.preview && (
          <>
            <div className="border-t border-white/5" />
            <ValidatorRow name="Preview" status={displayState.validation.preview!} />
          </>
        )}
      </div>

      {/* ── Risks Section ───────────────────────────────────────────────── */}
      {displayState.risks.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => { setShowRisks(!showRisks); trackRiskToggle(); }}
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
                className="space-y-1.5 overflow-hidden"
              >
                {displayState.risks.map((risk, i) => (
                  <RiskItem key={i} severity={risk.severity} reason={risk.reason} affectedScope={risk.affectedScope} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Confidence Breakdown ────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <button
          onClick={() => { setShowBreakdown(!showBreakdown); trackBreakdownToggle(); telemetry.expandedBreakdowns++; }}
          className="mb-2 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Confidence Breakdown</span>
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
              <BreakdownBar label="Planning Quality" score={displayState.breakdown.planningQuality} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Validation" score={displayState.breakdown.validationScore} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Workspace Consistency" score={displayState.breakdown.workspaceConsistency} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Historical Success" score={displayState.breakdown.historicalSuccess} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Specialist Confidence" score={displayState.breakdown.specialistConfidence} />
              <div className="border-t border-white/5" />
              <BreakdownBar label="Repair Stability" score={displayState.breakdown.repairStability} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Execution Strategy ──────────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex items-center justify-between rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Execution Strategy</span>
        </div>
        <span className="text-xs text-white/70">Multi-file</span>
      </div>

      {/* ── Complexity ──────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex items-center justify-between rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Complexity</span>
        </div>
        <span className="text-xs text-white/70">{displayState.impact.score > 50 ? "High" : displayState.impact.score > 25 ? "Medium" : "Low"}</span>
      </div>

      {/* ── Repair History ──────────────────────────────────────────────── */}
      {displayState.repairs.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRepairs(!showRepairs)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Repair History ({displayState.repairs.length})
              </span>
            </div>
            {showRepairs ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showRepairs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-1"
              >
                {displayState.repairs.map((repair, i) => (
                  <RepairItem key={i} attempt={repair.attempt} validator={repair.validator} status={repair.status} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Phase 14.3: Preview Intelligence ────────────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="mb-2 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Preview Health</span>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${getPreviewStatusBg(displayState.preview.status)}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wide ${getPreviewStatusColor(displayState.preview.status)}`}>
              {displayState.preview.status.toUpperCase()}
            </span>
            <span className="text-xs text-white/70">{displayState.preview.healthScore}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className={`h-full rounded-full ${displayState.preview.healthScore >= 80 ? "bg-emerald-400" : displayState.preview.healthScore >= 60 ? "bg-amber-400" : displayState.preview.healthScore >= 40 ? "bg-orange-400" : "bg-red-400"}`}
              initial={{ width: 0 }}
              animate={{ width: `${displayState.preview.healthScore}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Runtime Errors */}
          {displayState.preview.runtimeErrors.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Bug className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-medium text-red-400/80">Runtime Errors ({displayState.preview.runtimeErrors.length})</span>
              </div>
              {displayState.preview.runtimeErrors.map((err, i) => (
                <div key={i} className="rounded bg-red-400/5 px-2 py-1">
                  <p className="text-[10px] text-red-300/70 leading-relaxed">{err}</p>
                </div>
              ))}
            </div>
          )}

          {/* Visual Issues */}
          {displayState.preview.visualIssues.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Palette className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400/80">Visual Issues ({displayState.preview.visualIssues.length})</span>
              </div>
              {displayState.preview.visualIssues.slice(0, 4).map((issue, i) => (
                <div key={i} className={`rounded px-2 py-1 ${
                  issue.severity === "high" ? "bg-red-400/5" : issue.severity === "medium" ? "bg-amber-400/5" : "bg-white/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/70 leading-relaxed">{issue.description}</p>
                    <span className={`text-[8px] font-medium uppercase ${
                      issue.severity === "high" ? "text-red-400" : issue.severity === "medium" ? "text-amber-400" : "text-white/40"
                    }`}>{issue.severity}</span>
                  </div>
                  {issue.affectedFiles.length > 0 && (
                    <p className="mt-0.5 text-[9px] text-white/30 truncate">{issue.affectedFiles.join(", ")}</p>
                  )}
                </div>
              ))}
              {displayState.preview.visualIssues.length > 4 && (
                <p className="text-[9px] text-white/30 text-center">+{displayState.preview.visualIssues.length - 4} more</p>
              )}
            </div>
          )}

          {/* Auto Repair Status */}
          {displayState.preview.repairAttempts > 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-400/5 px-2 py-1">
              <RefreshCw className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] text-amber-300/70">
                Auto-repair: {displayState.preview.repairAttempts} attempt(s)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom spacing ──────────────────────────────────────────────── */}
      <div className="h-2" />
    </div>
  );
}
