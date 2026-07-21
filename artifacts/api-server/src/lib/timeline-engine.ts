// ─── Timeline Engine — Unified Engineering Activity Timeline ───────────────
// Phase 14.1
//
// Replaces fragmented activity updates with a single persistent execution
// timeline that visualizes the entire engineering workflow in real time.
// Each execution receives a unique timeline with ordered steps that map to
// every stage of the pipeline: planning → routing → execution → validation →
// repair → confidence → learning.
//
// The timeline engine is consumed by the editor pipeline and emits updates
// that can be streamed via SSE to the frontend.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimelineStatus = "running" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface TimelineStep {
  /** Unique step identifier within the timeline. */
  id: string;
  /** Step type — maps to execution phase (e.g., "planning", "execution", "validation"). */
  type: string;
  /** Human-readable title (e.g., "Analyzing workspace", "Executing task"). */
  title: string;
  /** Detailed description of what this step is doing. */
  description: string;
  /** Current status. */
  status: StepStatus;
  /** Specialist agent assigned (if applicable). */
  specialist?: string;
  /** ISO timestamp when the step started. */
  startedAt?: string;
  /** ISO timestamp when the step completed. */
  completedAt?: string;
  /** Duration in milliseconds (set on completion). */
  durationMs?: number;
  /** Files affected by this step. */
  affectedFiles: string[];
  /** Expandable metadata shown in the frontend. */
  metadata?: Record<string, unknown>;
}

export interface Timeline {
  /** Unique timeline identifier. */
  id: string;
  /** Execution ID this timeline belongs to. */
  executionId: string;
  /** Overall status. */
  status: TimelineStatus;
  /** ISO timestamp when the timeline was created. */
  startedAt: string;
  /** ISO timestamp when the timeline completed. */
  completedAt?: string;
  /** Total duration in milliseconds. */
  totalDurationMs?: number;
  /** Ordered list of steps. */
  steps: TimelineStep[];
  /** Current step index (for resuming). */
  currentStepIndex: number;
}

export interface TimelineUpdate {
  /** The timeline ID. */
  timelineId: string;
  /** The step ID that changed. */
  stepId: string;
  /** New status of the step. */
  status: StepStatus;
  /** Duration in ms (set when completed). */
  duration?: number;
  /** Files affected by this step. */
  affectedFiles?: string[];
  /** Specialist assigned to this step. */
  specialist?: string;
  /** Expandable metadata. */
  metadata?: Record<string, unknown>;
  /** Overall timeline status (set on terminal steps). */
  timelineStatus?: TimelineStatus;
  /** Total duration of the timeline. */
  totalDurationMs?: number;
}

export interface TimelineSummary {
  duration: string;
  taskCount: number;
  filesModified: number;
  validationPassed: boolean;
  repairAttempts: number;
  confidenceScore: number;
  learningUpdates: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "timelines")
  : path.resolve(process.cwd(), "data", "timelines");

const MAX_TIMELINES_PER_PROJECT = 100;

function ensureDataDir(projectId: string): string {
  const dir = path.join(DATA_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Timeline Engine ─────────────────────────────────────────────────────────

export class TimelineEngine {
  private timeline: Timeline;
  private onUpdate?: (update: TimelineUpdate) => void;
  private stepTimings: Map<string, number> = new Map();

  constructor(params: {
    executionId: string;
    onUpdate?: (update: TimelineUpdate) => void;
  }) {
    this.timeline = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      executionId: params.executionId,
      status: "running",
      startedAt: new Date().toISOString(),
      steps: [],
      currentStepIndex: 0,
    };
    this.onUpdate = params.onUpdate;
  }

  /** Get the timeline ID. */
  get id(): string {
    return this.timeline.id;
  }

  /** Get the current timeline snapshot. */
  getSnapshot(): Timeline {
    return { ...this.timeline, steps: [...this.timeline.steps] };
  }

  /** Get a summary of the completed timeline. */
  getSummary(): TimelineSummary | null {
    if (this.timeline.status === "running") return null;
    return {
      duration: this.formatDuration(this.timeline.totalDurationMs ?? 0),
      taskCount: this.timeline.steps.filter((s) => s.type === "task" || s.type === "execution").length,
      filesModified: this.getTotalAffectedFiles(),
      validationPassed: this.timeline.steps.some((s) => s.type === "validation" && s.status === "completed"),
      repairAttempts: this.timeline.steps.filter((s) => s.type === "repair").length,
      confidenceScore: this.getLastConfidenceScore(),
      learningUpdates: this.getLearningUpdatesText(),
    };
  }

  // ─── Step Management ─────────────────────────────────────────────────────

  /**
   * Add a new step to the timeline.
   * Returns the step ID.
   */
  addStep(params: {
    type: string;
    title: string;
    description: string;
    specialist?: string;
    affectedFiles?: string[];
    metadata?: Record<string, unknown>;
  }): string {
    const id = `${this.timeline.id}-step-${this.timeline.steps.length}`;
    const step: TimelineStep = {
      id,
      type: params.type,
      title: params.title,
      description: params.description,
      status: "pending",
      specialist: params.specialist,
      affectedFiles: params.affectedFiles ?? [],
      metadata: params.metadata,
    };
    this.timeline.steps.push(step);
    return id;
  }

  /**
   * Mark a step as running.
   * Sets startedAt and emits a timeline update.
   */
  startStep(stepId: string): void {
    const step = this.timeline.steps.find((s) => s.id === stepId);
    if (!step) {
      logger.warn({ stepId, timelineId: this.timeline.id }, "[timeline] Cannot start unknown step");
      return;
    }
    step.status = "running";
    step.startedAt = new Date().toISOString();
    this.stepTimings.set(stepId, Date.now());
    this.emitUpdate(step);
  }

  /**
   * Mark a step as completed.
   * Sets duration and emits a timeline update.
   */
  completeStep(stepId: string, extra?: Partial<Pick<TimelineStep, "affectedFiles" | "metadata">>): void {
    const step = this.timeline.steps.find((s) => s.id === stepId);
    if (!step) {
      logger.warn({ stepId, timelineId: this.timeline.id }, "[timeline] Cannot complete unknown step");
      return;
    }
    const startTime = this.stepTimings.get(stepId) ?? Date.now();
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - startTime;
    if (extra?.affectedFiles) step.affectedFiles = extra.affectedFiles;
    if (extra?.metadata) step.metadata = { ...step.metadata, ...extra.metadata };
    this.emitUpdate(step);
  }

  /**
   * Mark a step as failed.
   * Sets duration and emits a timeline update.
   */
  failStep(stepId: string, error?: string): void {
    const step = this.timeline.steps.find((s) => s.id === stepId);
    if (!step) {
      logger.warn({ stepId, timelineId: this.timeline.id }, "[timeline] Cannot fail unknown step");
      return;
    }
    const startTime = this.stepTimings.get(stepId) ?? Date.now();
    step.status = "failed";
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - startTime;
    if (error) {
      step.metadata = { ...step.metadata, error };
    }
    this.emitUpdate(step);
  }

  /** Convenience: add + start in one call. */
  beginStep(params: {
    type: string;
    title: string;
    description: string;
    specialist?: string;
    affectedFiles?: string[];
    metadata?: Record<string, unknown>;
  }): string {
    const id = this.addStep(params);
    this.startStep(id);
    return id;
  }

  // ─── Timeline Lifecycle ──────────────────────────────────────────────────

  /**
   * Complete the entire timeline.
   * Sets the overall status and emits a final update.
   */
  complete(): void {
    this.timeline.status = "completed";
    this.timeline.completedAt = new Date().toISOString();
    this.timeline.totalDurationMs = Date.now() - new Date(this.timeline.startedAt).getTime();
    // Emit a final update for the last step
    this.emitUpdate(null);
    // Persist
    this.persist();
    logger.info(
      { timelineId: this.timeline.id, executionId: this.timeline.executionId, durationMs: this.timeline.totalDurationMs, stepCount: this.timeline.steps.length },
      "[timeline] Timeline completed",
    );
  }

  /**
   * Fail the entire timeline.
   */
  fail(): void {
    this.timeline.status = "failed";
    this.timeline.completedAt = new Date().toISOString();
    this.timeline.totalDurationMs = Date.now() - new Date(this.timeline.startedAt).getTime();
    this.emitUpdate(null);
    this.persist();
    logger.info(
      { timelineId: this.timeline.id, executionId: this.timeline.executionId, durationMs: this.timeline.totalDurationMs },
      "[timeline] Timeline failed",
    );
  }

  // ─── Event Emission ──────────────────────────────────────────────────────

  private emitUpdate(step: TimelineStep | null): void {
    if (!this.onUpdate) return;
    const update: TimelineUpdate = {
      timelineId: this.timeline.id,
      stepId: step?.id ?? this.timeline.steps[this.timeline.steps.length - 1]?.id ?? "final",
      status: step?.status ?? this.timeline.status as unknown as StepStatus,
      duration: step?.durationMs,
      affectedFiles: step?.affectedFiles,
      specialist: step?.specialist,
      metadata: step?.metadata,
      timelineStatus: this.timeline.status,
      totalDurationMs: this.timeline.totalDurationMs,
    };
    try {
      this.onUpdate(update);
    } catch (err) {
      logger.warn({ err: String(err) }, "[timeline] onUpdate callback error");
    }
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private persist(): void {
    try {
      const projectId = this.timeline.executionId.split("-")[0] || "unknown";
      const dir = ensureDataDir(projectId);
      const filePath = path.join(dir, `${this.timeline.executionId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.timeline, null, 2), "utf-8");
    } catch (err) {
      logger.error({ err: String(err) }, "[timeline] Failed to persist timeline");
    }
  }

  /** Archive old timelines beyond MAX_TIMELINES_PER_PROJECT. */
  static archiveOld(projectId: string): number {
    try {
      const dir = path.join(DATA_DIR, projectId);
      if (!fs.existsSync(dir)) return 0;
      const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({
          name: f,
          stat: fs.statSync(path.join(dir, f)),
        }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

      let archived = 0;
      while (files.length > MAX_TIMELINES_PER_PROJECT) {
        const oldest = files.pop()!;
        const archivePath = path.join(dir, oldest.name + ".archived");
        fs.renameSync(path.join(dir, oldest.name), archivePath);
        archived++;
      }
      return archived;
    } catch (err) {
      logger.warn({ projectId, err: String(err) }, "[timeline] Failed to archive old timelines");
      return 0;
    }
  }

  /** Load a persisted timeline. */
  static load(projectId: string, executionId: string): Timeline | null {
    try {
      const filePath = path.join(DATA_DIR, projectId, `${executionId}.json`);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as Timeline;
    } catch (err) {
      logger.warn({ projectId, executionId, err: String(err) }, "[timeline] Failed to load timeline");
      return null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private getTotalAffectedFiles(): number {
    const files = new Set<string>();
    for (const step of this.timeline.steps) {
      for (const f of step.affectedFiles) {
        files.add(f);
      }
    }
    return files.size;
  }

  private getLastConfidenceScore(): number {
    for (let i = this.timeline.steps.length - 1; i >= 0; i--) {
      const step = this.timeline.steps[i];
      if (step.type === "confidence" && step.metadata?.score != null) {
        return step.metadata.score as number;
      }
    }
    return 0;
  }

  private getLearningUpdatesText(): string {
    const learningSteps = this.timeline.steps.filter((s) => s.type === "learning");
    if (learningSteps.length === 0) return "None";
    const updates: string[] = [];
    for (const step of learningSteps) {
      if (step.metadata?.routingOptimizations) {
        updates.push(`${step.metadata.routingOptimizations} routing optimizations`);
      }
      if (step.metadata?.policyRevisions) {
        updates.push(`${step.metadata.policyRevisions} policy revisions`);
      }
    }
    return updates.length > 0 ? updates.join(", ") : "Completed";
  }

  /** Get timing statistics for telemetry. */
  getTimingStats(): {
    totalSteps: number;
    averageStepDuration: number;
    slowestStep: { id: string; durationMs: number } | null;
    fastestStep: { id: string; durationMs: number } | null;
  } {
    const completedSteps = this.timeline.steps.filter((s) => s.durationMs != null);
    const totalSteps = completedSteps.length;
    if (totalSteps === 0) {
      return { totalSteps: 0, averageStepDuration: 0, slowestStep: null, fastestStep: null };
    }

    let totalDuration = 0;
    let slowest = completedSteps[0];
    let fastest = completedSteps[0];

    for (const s of completedSteps) {
      const d = s.durationMs!;
      totalDuration += d;
      if (d > slowest.durationMs!) slowest = s;
      if (d < fastest.durationMs!) fastest = s;
    }

    return {
      totalSteps,
      averageStepDuration: totalDuration / totalSteps,
      slowestStep: { id: slowest.id, durationMs: slowest.durationMs! },
      fastestStep: { id: fastest.id, durationMs: fastest.durationMs! },
    };
  }
}
