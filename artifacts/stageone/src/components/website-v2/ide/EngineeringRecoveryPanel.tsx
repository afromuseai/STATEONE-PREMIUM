// ─── EngineeringRecoveryPanel — Autonomous Recovery & Rollback UI ────────────
// Phase 14.5
//
// Displays live snapshot management, rollback events, and recovery status during
// Website Studio editing. Updates from SSE events via wsRuntimeEmitter.
// Complements EngineeringVisualPanel.
//
// Architecture:
//   Recovery Engine → SSE → EngineeringRecoveryPanel
//                           → Live Recovery Status Updates
//                           → Execution Complete (persistent summary)

import { useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Camera,
  RotateCcw,
  History,
  Layers,
  FileCode,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type {
  WSRecoveryUpdate,
  WSRecoveryEventType,
  WSRecoveryTrigger,
} from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoveryPanelState {
  /** Latest recovery event type. */
  eventType: WSRecoveryEventType | null;
  /** Current snapshot ID. */
  snapshotId: string | null;
  /** Rollback trigger if applicable. */
  trigger: WSRecoveryTrigger | null;
  /** Human-readable description. */
  description: string;
  /** Files that were rolled back. */
  rolledBackFiles: string[];
  /** Number of snapshots taken. */
  snapshotCount: number;
  /** Current version index. */
  currentVersion: number;
  /** Total versions available. */
  totalVersions: number;
  /** Additional metadata. */
  metadata: Record<string, unknown> | null;
  /** When the event occurred. */
  timestamp: string | null;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
  /** Event history for display. */
  history: Array<{
    eventType: WSRecoveryEventType;
    description: string;
    snapshotId?: string;
    trigger?: WSRecoveryTrigger;
    timestamp: string;
  }>;
  /** Whether a rollback is in progress. */
  rollbackInProgress: boolean;
  /** Whether the last rollback was successful. */
  lastRollbackSuccess: boolean | null;
}

type RecoveryAction =
  | { type: "UPDATE"; payload: WSRecoveryUpdate }
  | { type: "RESET" };

function recoveryReducer(state: RecoveryPanelState, action: RecoveryAction): RecoveryPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      const isRollbackStart = p.eventType === "rollback_started";
      const isRollbackEnd = p.eventType === "rollback_completed" || p.eventType === "recovery_success" || p.eventType === "recovery_failed";
      return {
        ...state,
        eventType: p.eventType,
        snapshotId: p.snapshotId ?? state.snapshotId,
        trigger: p.trigger ?? state.trigger,
        description: p.description,
        rolledBackFiles: p.rolledBackFiles ?? state.rolledBackFiles,
        snapshotCount: p.snapshotCount ?? state.snapshotCount,
        currentVersion: p.currentVersion ?? state.currentVersion,
        totalVersions: p.totalVersions ?? state.totalVersions,
        metadata: p.metadata ?? state.metadata,
        timestamp: p.timestamp,
        initialized: true,
        rollbackInProgress: isRollbackStart ? true : isRollbackEnd ? false : state.rollbackInProgress,
        lastRollbackSuccess: p.eventType === "recovery_success" ? true : p.eventType === "recovery_failed" ? false : state.lastRollbackSuccess,
        history: [
          ...state.history,
          {
            eventType: p.eventType,
            description: p.description,
            snapshotId: p.snapshotId,
            trigger: p.trigger,
            timestamp: p.timestamp,
          },
        ].slice(-50),
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: RecoveryPanelState = {
  eventType: null,
  snapshotId: null,
  trigger: null,
  description: "",
  rolledBackFiles: [],
  snapshotCount: 0,
  currentVersion: 0,
  totalVersions: 0,
  metadata: null,
  timestamp: null,
  initialized: false,
  history: [],
  rollbackInProgress: false,
  lastRollbackSuccess: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventTypeIcon(eventType: WSRecoveryEventType | null): React.ElementType {
  switch (eventType) {
    case "snapshot_created":     return Camera;
    case "rollback_started":     return RotateCcw;
    case "rollback_completed":   return ShieldCheck;
    case "recovery_success":     return CheckCircle;
    case "recovery_failed":      return XCircle;
    default:                     return History;
  }
}

function getEventTypeColor(eventType: WSRecoveryEventType | null): string {
  switch (eventType) {
    case "snapshot_created":     return "text-cyan-400";
    case "rollback_started":     return "text-amber-400";
    case "rollback_completed":   return "text-emerald-400";
    case "recovery_success":     return "text-emerald-400";
    case "recovery_failed":      return "text-red-400";
    default:                     return "text-white/40";
  }
}

function getTriggerIcon(trigger: WSRecoveryTrigger | null): React.ElementType {
  switch (trigger) {
    case "validation_failed":           return XCircle;
    case "confidence_below_threshold":  return ShieldAlert;
    case "visual_score_critical":       return AlertTriangle;
    case "runtime_crashes_persist":     return AlertTriangle;
    case "manual":                      return RotateCcw;
    default:                            return Shield;
  }
}

function getTriggerColor(trigger: WSRecoveryTrigger | null): string {
  switch (trigger) {
    case "validation_failed":           return "text-red-400";
    case "confidence_below_threshold":  return "text-amber-400";
    case "visual_score_critical":       return "text-orange-400";
    case "runtime_crashes_persist":     return "text-red-400";
    case "manual":                      return "text-cyan-400";
    default:                            return "text-white/40";
  }
}

function getTriggerLabel(trigger: WSRecoveryTrigger | null): string {
  switch (trigger) {
    case "validation_failed":           return "Validation Failed";
    case "confidence_below_threshold":  return "Low Confidence";
    case "visual_score_critical":       return "Visual Score Critical";
    case "runtime_crashes_persist":     return "Runtime Crashes";
    case "manual":                      return "Manual Rollback";
    default:                            return "Unknown";
  }
}

function getEventTypeLabel(eventType: WSRecoveryEventType | null): string {
  switch (eventType) {
    case "snapshot_created":     return "Snapshot Taken";
    case "rollback_started":     return "Rollback Started";
    case "rollback_completed":   return "Rollback Completed";
    case "recovery_success":     return "Recovery Successful";
    case "recovery_failed":      return "Recovery Failed";
    default:                     return "Recovery Event";
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

function formatShortTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Version indicator badge */
function VersionBadge({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#303030] bg-[#1E1E1E] px-2.5 py-1">
      <Layers className="h-3 w-3 text-cyan-400" />
      <span className="text-[10px] font-medium text-white/60">
        v{current}/{total}
      </span>
    </div>
  );
}

/** Snapshot count badge */
function SnapshotBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#303030] bg-[#1E1E1E] px-2.5 py-1">
      <Camera className="h-3 w-3 text-white/40" />
      <span className="text-[10px] font-medium text-white/50">{count} snapshot{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

/** Trigger badge */
function TriggerBadge({ trigger }: { trigger: WSRecoveryTrigger }) {
  const Icon = getTriggerIcon(trigger);
  const color = getTriggerColor(trigger);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
    >
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] font-medium" style={{ color }}>{getTriggerLabel(trigger)}</span>
    </div>
  );
}

/** History event item */
function HistoryEvent({ event }: { event: RecoveryPanelState["history"][0] }) {
  const Icon = getEventTypeIcon(event.eventType);
  const color = getEventTypeColor(event.eventType);

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${color}`}>
            {getEventTypeLabel(event.eventType)}
          </span>
          {event.trigger && (
            <TriggerBadge trigger={event.trigger} />
          )}
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">{event.description}</p>
        <span className="text-[9px] text-white/30">{formatShortTimestamp(event.timestamp)}</span>
      </div>
    </div>
  );
}

/** Rolled back file item */
function RolledBackFile({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-7">
      <RotateCcw className="h-2.5 w-2.5 text-emerald-400/60 shrink-0" />
      <span className="text-[10px] text-white/50 truncate">{path}</span>
    </div>
  );
}

// ─── EngineeringRecoveryPanel Component ───────────────────────────────────────

interface EngineeringRecoveryPanelProps {
  /** Optional external state override */
  externalState?: RecoveryPanelState | null;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringRecoveryPanel({ externalState, compact = false }: EngineeringRecoveryPanelProps) {
  const [state, dispatch] = useReducer(recoveryReducer, initialState);
  const [showHistory, setShowHistory] = useState(true);
  const [showRolledBackFiles, setShowRolledBackFiles] = useState(false);

  // Subscribe to runtime recovery events
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "RecoveryUpdate") {
        const update = event.payload as unknown as WSRecoveryUpdate;
        dispatch({ type: "UPDATE", payload: update });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState]);

  // Use external state if provided
  const displayState = externalState ?? state;

  if (!displayState.initialized && !externalState) return null;

  const latestEventType = displayState.eventType;
  const hasRolledBackFiles = displayState.rolledBackFiles.length > 0;
  const hasHistory = displayState.history.length > 0;
  const isRollingBack = displayState.rollbackInProgress;
  const isError = latestEventType === "recovery_failed";
  const isWarning = latestEventType === "rollback_started" || latestEventType === "rollback_completed";

  return (
    <div className="select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className={`h-4 w-4 ${getEventTypeColor(latestEventType)}`} />
          <span className="text-sm font-medium text-white/80">Recovery & Rollback</span>
        </div>
        <div className="flex items-center gap-2">
          {displayState.timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(displayState.timestamp)}</span>
          )}
        </div>
      </div>

      {/* ── Status Banner ──────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        {isError ? (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-medium text-red-300">Recovery Failed</span>
            </div>
            <p className="text-[11px] text-red-200/60 leading-relaxed">{displayState.description}</p>
          </div>
        ) : isWarning ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              {isRollingBack ? (
                <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-xs font-medium text-amber-300">
                {isRollingBack ? "Rolling Back…" : "Rollback Completed"}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/60 leading-relaxed">{displayState.description}</p>
            {displayState.trigger && (
              <div className="mt-2">
                <TriggerBadge trigger={displayState.trigger} />
              </div>
            )}
          </div>
        ) : displayState.description ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <p className="text-[11px] text-emerald-200/70 leading-relaxed">{displayState.description}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <VersionBadge current={displayState.currentVersion} total={displayState.totalVersions} />
          <SnapshotBadge count={displayState.snapshotCount} />
          {displayState.lastRollbackSuccess === true && (
            <div className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1">
              <CheckCircle className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400/80">Restored</span>
            </div>
          )}
          {displayState.lastRollbackSuccess === false && (
            <div className="flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-[10px] font-medium text-red-400/80">Failed</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Rolled Back Files ───────────────────────────────────────────── */}
      {hasRolledBackFiles && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowRolledBackFiles(!showRolledBackFiles)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Rolled Back ({displayState.rolledBackFiles.length})
              </span>
            </div>
            {showRolledBackFiles ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showRolledBackFiles && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-1"
              >
                {displayState.rolledBackFiles.slice(0, 20).map((path, i) => (
                  <RolledBackFile key={i} path={path} />
                ))}
                {displayState.rolledBackFiles.length > 20 && (
                  <span className="text-[9px] text-white/30 pl-7">
                    +{displayState.rolledBackFiles.length - 20} more files
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Event History ───────────────────────────────────────────────── */}
      {hasHistory && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="mb-2 flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Event History ({displayState.history.length})
              </span>
            </div>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 py-1"
              >
                {[...displayState.history].reverse().slice(0, 20).map((event, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="border-t border-white/5" />}
                    <HistoryEvent event={event} />
                  </React.Fragment>
                ))}
                {displayState.history.length > 20 && (
                  <div className="border-t border-white/5 pt-1 pb-1">
                    <span className="text-[9px] text-white/30 pl-7">
                      +{displayState.history.length - 20} earlier events
                    </span>
                  </div>
                )}
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
