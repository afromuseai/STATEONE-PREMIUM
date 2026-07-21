// ─── EngineeringTimeline — Unified Execution Progress UI ─────────────────────
// Phase 14.1A
//
// Replaces scattered activity bubbles and temporary loading states with a
// single persistent Engineering Timeline that visualises the complete execution
// lifecycle inside Website Studio.
//
// Architecture:
//   User Edit → Website Studio → Timeline SSE → EngineeringTimeline
//   → Incremental Step Updates → Completed Timeline
//
// The component subscribes to WSRuntimeEventBus for TimelineUpdate events,
// maintains an internal reducer for O(1) step updates, and renders the full
// timeline with animated status transitions, expandable metadata, and telemetry.

import { useEffect, useReducer, useRef, useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  GitBranch,
  FileCode,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  RefreshCw,
  Brain,
  Layers,
  Activity,
  Loader2,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSTimelineUpdate } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface TimelineStepData {
  id: string;
  type: string;
  title: string;
  description: string;
  status: StepStatus;
  specialist?: string;
  durationMs?: number;
  affectedFiles: string[];
  metadata?: Record<string, unknown>;
}

export interface TimelineState {
  timelineId: string | null;
  status: "running" | "completed" | "failed";
  steps: TimelineStepData[];
  totalDurationMs?: number;
}

// ─── Default Step Definitions ─────────────────────────────────────────────────
// The canonical pipeline stages expected during an edit execution.
// Steps from SSE events are merged into these — new step types are appended.

const DEFAULT_STEP_TYPES: Array<{
  type: string;
  icon: React.ElementType;
  label: string;
  defaultDescription: string;
}> = [
  { type: "workspace",  icon: Search,     label: "Workspace Analysis",  defaultDescription: "Scanning files and building context" },
  { type: "planning",   icon: GitBranch,  label: "Execution Planning",  defaultDescription: "Decomposing the plan into tasks" },
  { type: "routing",    icon: Activity,   label: "Specialist Assignment", defaultDescription: "Routing tasks to specialists" },
  { type: "execution",  icon: FileCode,   label: "Task Execution",     defaultDescription: "Executing changes" },
  { type: "validation", icon: Shield,     label: "Validation",         defaultDescription: "Validating changes" },
  { type: "repair",     icon: RefreshCw,  label: "Repair",             defaultDescription: "Fixing validation errors" },
  { type: "analysis",   icon: Brain,      label: "Confidence Analysis", defaultDescription: "Analyzing confidence and impact" },
  { type: "learning",   icon: Zap,        label: "Optimization",       defaultDescription: "Learning from execution" },
];

// ─── Reducer ──────────────────────────────────────────────────────────────────
// Pure reducer for O(1) step lookups by stepId. Only the affected step updates.

type TimelineAction =
  | { type: "INIT"; payload: { timelineId: string } }
  | { type: "UPDATE_STEP"; payload: WSTimelineUpdate }
  | { type: "COMPLETE"; payload: { totalDurationMs?: number } }
  | { type: "FAIL"; payload: { totalDurationMs?: number } }
  | { type: "RESET" };

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "INIT":
      return {
        timelineId: action.payload.timelineId,
        status: "running",
        steps: [],
        totalDurationMs: undefined,
      };

    case "UPDATE_STEP": {
      const { stepId, status, duration, affectedFiles, specialist, metadata, timelineStatus, totalDurationMs } = action.payload;
      const existingIndex = state.steps.findIndex((s) => s.id === stepId);

      // Build the step data
      const stepData: TimelineStepData = {
        id: stepId,
        type: metadata?.type as string ?? "unknown",
        title: metadata?.title as string ?? stepId,
        description: metadata?.description as string ?? "",
        status: status as StepStatus,
        specialist,
        durationMs: duration,
        affectedFiles: affectedFiles ?? [],
        metadata,
      };

      let newSteps: TimelineStepData[];
      if (existingIndex >= 0) {
        // Update existing step — O(1) via index
        newSteps = [...state.steps];
        newSteps[existingIndex] = { ...newSteps[existingIndex], ...stepData };
      } else {
        // Append new step
        newSteps = [...state.steps, stepData];
      }

      return {
        ...state,
        status: (timelineStatus as TimelineState["status"]) ?? state.status,
        totalDurationMs: totalDurationMs ?? state.totalDurationMs,
        steps: newSteps,
      };
    }

    case "COMPLETE":
      return {
        ...state,
        status: "completed",
        totalDurationMs: action.payload.totalDurationMs ?? state.totalDurationMs,
      };

    case "FAIL":
      return {
        ...state,
        status: "failed",
        totalDurationMs: action.payload.totalDurationMs ?? state.totalDurationMs,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

const initialState: TimelineState = {
  timelineId: null,
  status: "running",
  steps: [],
  totalDurationMs: undefined,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStepIcon(type: string): React.ElementType {
  const def = DEFAULT_STEP_TYPES.find((d) => d.type === type);
  return def?.icon ?? Activity;
}

function getStepLabel(type: string): string {
  const def = DEFAULT_STEP_TYPES.find((d) => d.type === type);
  return def?.label ?? type;
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function getStatusColor(status: StepStatus): string {
  switch (status) {
    case "pending":   return "text-white/20";
    case "running":   return "text-amber-400";
    case "completed": return "text-emerald-400";
    case "failed":    return "text-red-400";
  }
}

function getStatusBg(status: StepStatus): string {
  switch (status) {
    case "pending":   return "bg-white/5";
    case "running":   return "bg-amber-400/10";
    case "completed": return "bg-emerald-400/10";
    case "failed":    return "bg-red-400/10";
  }
}

function getConnectorColor(status: StepStatus): string {
  switch (status) {
    case "completed": return "bg-emerald-400/40";
    case "running":   return "bg-amber-400/40";
    case "failed":    return "bg-red-400/40";
    default:          return "bg-white/5";
  }
}

// ─── Metadata Renderers ──────────────────────────────────────────────────────

function renderStepMetadata(type: string, metadata?: Record<string, unknown>): React.ReactNode {
  if (!metadata) return null;

  switch (type) {
    case "workspace":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.strategy != null && <div className="flex justify-between"><span>Strategy</span><span className="text-white/70">{String(metadata.strategy)}</span></div>}
          {metadata.complexity != null && <div className="flex justify-between"><span>Complexity</span><span className="text-white/70">{String(metadata.complexity)}</span></div>}
          {metadata.predictedFiles != null && <div className="flex justify-between"><span>Predicted Files</span><span className="text-white/70">{String(metadata.predictedFiles)}</span></div>}
          {metadata.fileCount != null && <div className="flex justify-between"><span>Files Scanned</span><span className="text-white/70">{String(metadata.fileCount)}</span></div>}
          {metadata.framework != null && <div className="flex justify-between"><span>Framework</span><span className="text-white/70">{String(metadata.framework)}</span></div>}
        </div>
      );

    case "planning":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.taskCount != null && <div className="flex justify-between"><span>Tasks</span><span className="text-white/70">{String(metadata.taskCount)}</span></div>}
          {metadata.parallelCount != null && <div className="flex justify-between"><span>Parallel Tasks</span><span className="text-white/70">{String(metadata.parallelCount)}</span></div>}
          {metadata.sequentialChains != null && <div className="flex justify-between"><span>Sequential Chains</span><span className="text-white/70">{String(metadata.sequentialChains)}</span></div>}
        </div>
      );

    case "routing":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.taskTitle != null && <div className="flex justify-between"><span>Task</span><span className="text-white/70 truncate max-w-[180px]">{String(metadata.taskTitle)}</span></div>}
          {metadata.routingReason != null && <div className="flex justify-between"><span>Reason</span><span className="text-white/70 truncate max-w-[180px]">{String(metadata.routingReason)}</span></div>}
          {metadata.routingConfidence != null && <div className="flex justify-between"><span>Confidence</span><span className="text-white/70">{String(metadata.routingConfidence)}</span></div>}
        </div>
      );

    case "execution":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.changedFiles != null && <div className="flex justify-between"><span>Files Modified</span><span className="text-white/70">{String(metadata.changedFiles)}</span></div>}
          {metadata.strategy != null && metadata.strategy !== "unknown" && <div className="flex justify-between"><span>Strategy</span><span className="text-white/70">{String(metadata.strategy)}</span></div>}
          {metadata.complexity != null && metadata.complexity !== "unknown" && <div className="flex justify-between"><span>Complexity</span><span className="text-white/70">{String(metadata.complexity)}</span></div>}
        </div>
      );

    case "validation":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.validators != null && Array.isArray(metadata.validators) && (
            <div className="flex justify-between">
              <span>Validators</span>
              <span className="text-white/70">{(metadata.validators as string[]).join(", ")}</span>
            </div>
          )}
          {metadata.errorCount != null && <div className="flex justify-between"><span>Errors</span><span className="text-white/70">{String(metadata.errorCount)}</span></div>}
          {metadata.success != null && <div className="flex justify-between"><span>Passed</span><span className="text-white/70">{String(metadata.success)}</span></div>}
        </div>
      );

    case "repair":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.retryNumber != null && <div className="flex justify-between"><span>Attempt</span><span className="text-white/70">{String(metadata.retryNumber)}</span></div>}
          {metadata.repairedErrors != null && <div className="flex justify-between"><span>Errors Repaired</span><span className="text-white/70">{String(metadata.repairedErrors)}</span></div>}
        </div>
      );

    case "analysis":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.confidenceScore != null && <div className="flex justify-between"><span>Confidence</span><span className="text-white/70">{String(metadata.confidenceScore)}%</span></div>}
          {metadata.impactScore != null && <div className="flex justify-between"><span>Impact Score</span><span className="text-white/70">{String(metadata.impactScore)}</span></div>}
          {metadata.level != null && <div className="flex justify-between"><span>Level</span><span className="text-white/70">{String(metadata.level)}</span></div>}
        </div>
      );

    case "learning":
      return (
        <div className="space-y-1 text-xs text-white/50">
          {metadata.routingImprovements != null && <div className="flex justify-between"><span>Routing Optimizations</span><span className="text-white/70">{String(metadata.routingImprovements)}</span></div>}
          {metadata.policyRevisions != null && <div className="flex justify-between"><span>Policy Revisions</span><span className="text-white/70">{String(metadata.policyRevisions)}</span></div>}
        </div>
      );

    default:
      // Generic metadata display for unknown types
      const entries = Object.entries(metadata).filter(([k]) => !["type", "title", "description"].includes(k));
      if (entries.length === 0) return null;
      return (
        <div className="space-y-1 text-xs text-white/50">
          {entries.slice(0, 6).map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <span className="text-white/70 truncate max-w-[180px]">{String(val)}</span>
            </div>
          ))}
        </div>
      );
  }
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

interface TimelineTelemetry {
  renderCount: number;
  expandedStepCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  maxUpdateLatency: number;
  autoScrollCount: number;
}

function createTimelineTelemetry(): TimelineTelemetry {
  return {
    renderCount: 0,
    expandedStepCount: 0,
    lastRenderTime: 0,
    totalRenderTime: 0,
    maxUpdateLatency: 0,
    autoScrollCount: 0,
  };
}

// ─── EngineeringTimeline Component ────────────────────────────────────────────

interface EngineeringTimelineProps {
  /** Optional external state — if provided, component uses it instead of subscribing to events */
  externalState?: TimelineState | null;
  /** Optional callback for telemetry data */
  onTelemetry?: (t: TimelineTelemetry) => void;
  /** Visual density */
  compact?: boolean;
}

export function EngineeringTimeline({ externalState, onTelemetry, compact = false }: EngineeringTimelineProps) {
  const [state, dispatch] = useReducer(timelineReducer, initialState);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [telemetry] = useState(createTimelineTelemetry);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevRunningCountRef = useRef(0);
  const renderStartRef = useRef(0);
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  // Track render for telemetry
  useEffect(() => {
    const now = Date.now();
    telemetry.renderCount++;
    if (renderStartRef.current > 0) {
      const latency = now - renderStartRef.current;
      telemetry.totalRenderTime += latency;
      telemetry.lastRenderTime = latency;
      if (latency > telemetry.maxUpdateLatency) {
        telemetry.maxUpdateLatency = latency;
      }
    }
    renderStartRef.current = 0;
  });

  // Subscribe to timeline events from the runtime
  useEffect(() => {
    // If external state is provided, use it directly instead
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type !== "TimelineUpdate") return;

      const update = event.payload as unknown as WSTimelineUpdate;
      renderStartRef.current = Date.now();

      // If no timeline initialized yet, init with the first event's timelineId
      if (!state.timelineId && update.timelineId) {
        dispatch({ type: "INIT", payload: { timelineId: update.timelineId } });
      }

      if (update.stepId) {
        dispatch({ type: "UPDATE_STEP", payload: update });
      }

      // Handle terminal timeline status
      if (update.timelineStatus === "completed") {
        dispatch({ type: "COMPLETE", payload: { totalDurationMs: update.totalDurationMs } });
      } else if (update.timelineStatus === "failed") {
        dispatch({ type: "FAIL", payload: { totalDurationMs: update.totalDurationMs } });
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);
    return () => unsub();
  }, [externalState, state.timelineId]);

  // Use external state if provided
  const displayState = externalState ?? state;

  // Auto-scroll to the newest running step
  useEffect(() => {
    if (displayState.status !== "running") return;

    const runningCount = displayState.steps.filter((s) => s.status === "running").length;
    if (runningCount > prevRunningCountRef.current && scrollRef.current) {
      const runningStep = scrollRef.current.querySelector('[data-status="running"]');
      if (runningStep) {
        runningStep.scrollIntoView({ behavior: "smooth", block: "center" });
        telemetryRef.current.autoScrollCount++;
      }
    }
    prevRunningCountRef.current = runningCount;
  }, [displayState.steps, displayState.status]);

  // Toggle step expand
  const toggleExpand = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
        // Track expanded count
        telemetryRef.current.expandedStepCount = next.size;
      }
      return next;
    });
  }, []);

  // Report telemetry
  useEffect(() => {
    if (displayState.status !== "running") {
      onTelemetry?.(telemetryRef.current);
    }
  }, [displayState.status, onTelemetry]);

  // ── Build step display list ──────────────────────────────────────────────
  // Merge SSE steps with default step types for a complete picture.
  // Default steps appear as "pending" until their SSE event arrives.
  type MergedStep = TimelineStepData & { icon: React.ElementType };
  const mergedSteps = useMemo((): MergedStep[] => {
    if (displayState.steps.length === 0) {
      // No real steps yet — show defaults as pending
      return DEFAULT_STEP_TYPES.map((def, i) => ({
        id: `default-${def.type}`,
        type: def.type,
        title: def.label,
        description: def.defaultDescription,
        status: "pending" as StepStatus,
        icon: def.icon,
        affectedFiles: [] as string[],
        specialist: undefined,
        durationMs: undefined,
        metadata: undefined,
      }));
    }

    // Build a map of received steps by type for merging
    const stepsByType = new Map<string, TimelineStepData>();
    for (const step of displayState.steps) {
      const existing = stepsByType.get(step.type);
      // Keep the latest (completed overrides running, etc.)
      if (!existing || step.status === "completed" || step.status === "failed") {
        stepsByType.set(step.type, step);
      }
    }

    // Merge with default step types
    const result: MergedStep[] = [];
    const usedTypes = new Set<string>();

    // First, render known default types in order
    for (const def of DEFAULT_STEP_TYPES) {
      const realStep = stepsByType.get(def.type);
      if (realStep) {
        usedTypes.add(def.type);
        result.push({ ...realStep, icon: def.icon });
      } else {
        // Show pending default
        result.push({
          id: `default-${def.type}`,
          type: def.type,
          title: def.label,
          description: def.defaultDescription,
          status: "pending" as const,
          icon: def.icon,
          affectedFiles: [],
          specialist: undefined,
          durationMs: undefined,
          metadata: undefined,
        });
      }
    }

    // Append any extra steps not in our defaults (e.g., custom step types)
    for (const step of displayState.steps) {
      if (!usedTypes.has(step.type)) {
        const Icon = getStepIcon(step.type);
        result.push({ ...step, icon: Icon });
        usedTypes.add(step.type);
      }
    }

    return result;
  }, [displayState.steps]);

  // Determine completion summary
  const completionSummary = useMemo(() => {
    if (displayState.status === "running") return null;
    const completed = displayState.steps.filter((s) => s.status === "completed").length;
    const failed = displayState.steps.filter((s) => s.status === "failed").length;
    const total = displayState.steps.length || DEFAULT_STEP_TYPES.length;
    return { completed, failed, total, duration: formatDuration(displayState.totalDurationMs) };
  }, [displayState.status, displayState.steps, displayState.totalDurationMs]);

  const isActive = displayState.status === "running";
  const hasAnyCompleted = displayState.steps.some((s) => s.status === "completed" || s.status === "failed");

  return (
    <div className="select-none" ref={scrollRef}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-white/80">Engineering Execution</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Running...
            </span>
          )}
          {!isActive && completionSummary && (
            <span className="text-xs text-white/40">
              {formatDuration(displayState.totalDurationMs)}
            </span>
          )}
        </div>
      </div>

      {/* ── Overall Progress ────────────────────────────────────────────── */}
      {isActive && mergedSteps.length > 0 && (
        <div className="mb-3 px-4">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              initial={{ width: "0%" }}
              animate={{
                width: `${(mergedSteps.filter((s) => s.status === "completed" || s.status === "failed").length / Math.max(mergedSteps.length, 1)) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/30">
            <span>
              {mergedSteps.filter((s) => s.status === "completed" || s.status === "failed").length}/{mergedSteps.length} steps
            </span>
            {displayState.totalDurationMs != null && (
              <span>{formatDuration(displayState.totalDurationMs)}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Completion Summary ──────────────────────────────────────────── */}
      {completionSummary && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
          <div className="flex items-center gap-2">
            {completionSummary.failed === 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
            <span className="text-xs text-white/70">
              {completionSummary.failed === 0
                ? `All ${completionSummary.completed} steps completed`
                : `${completionSummary.completed} completed, ${completionSummary.failed} failed`}
            </span>
            <span className="ml-auto text-[10px] text-white/40">{completionSummary.duration}</span>
          </div>
        </div>
      )}

      {/* ── Step List ───────────────────────────────────────────────────── */}
      <div className="space-y-0">
        {mergedSteps.map((step, index) => {
          const Icon = step.icon;
          const isExpanded = expandedSteps.has(step.id);
          const isLast = index === mergedSteps.length - 1;
          const hasMetadata = step.metadata && Object.keys(step.metadata).length > 0;

          return (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
              data-status={step.status}
              className="relative"
            >
              {/* Connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[18px] top-[36px] h-[calc(100%+4px)] w-px transition-colors duration-300 ${getConnectorColor(step.status)}`}
                />
              )}

              {/* Step card */}
              <div
                className={`mx-2 cursor-pointer rounded-lg border px-3 py-2.5 transition-all duration-200 hover:border-white/10 ${getStatusBg(step.status)} border-transparent`}
                onClick={() => hasMetadata && toggleExpand(step.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className={`relative mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center ${getStatusColor(step.status)}`}>
                    {step.status === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : step.status === "completed" ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : step.status === "failed" ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${getStatusColor(step.status)}`} />
                      <span className={`text-xs font-medium ${getStatusColor(step.status)}`}>
                        {step.title || getStepLabel(step.type)}
                      </span>
                      {step.specialist && (
                        <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-400/70">
                          {step.specialist}
                        </span>
                      )}
                      {step.status === "running" && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400/60">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
                          Running
                        </span>
                      )}
                      {step.status === "completed" && step.durationMs != null && (
                        <span className="ml-auto text-[10px] text-white/30">{formatDuration(step.durationMs)}</span>
                      )}
                    </div>

                    {/* Description */}
                    {(step.description || step.affectedFiles.length > 0) && (
                      <div className="mt-0.5">
                        <p className="text-[10px] leading-tight text-white/40 line-clamp-2">{step.description}</p>
                        {step.affectedFiles.length > 0 && (
                          <p className="mt-0.5 text-[9px] text-white/20">
                            {step.affectedFiles.length} file{step.affectedFiles.length !== 1 ? "s" : ""} affected
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expand chevron */}
                  {hasMetadata && (
                    <button
                      className="flex-shrink-0 p-0.5 text-white/20 hover:text-white/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(step.id);
                      }}
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {/* Expanded metadata */}
                <AnimatePresence initial={false}>
                  {isExpanded && hasMetadata && (
                    <motion.div
                      key="metadata"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 border-t border-white/5 pt-2">
                        {renderStepMetadata(step.type, step.metadata)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {mergedSteps.length === 0 && !isActive && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-white/20">
          <Activity className="h-8 w-8" />
          <p className="text-xs">No execution timeline yet</p>
        </div>
      )}
    </div>
  );
}
