// ─── ActivityEngine 2.0 — Real-Time AI Execution Activity Layer ──────────────
//
// A pure TypeScript class that owns the lifecycle of every AI work item.
// The runtime calls start/update/complete/fail to report what the AI is doing.
// The UI subscribes to events and reads state — never mutates.
// No React dependency. No chat dependency. Standalone.
//
// Design principles:
// - Queue-based: activities form an ordered queue, not a single current item
// - Progress-aware: activities can report 0-100 progress with detail
// - File-aware: reading/writing activities include affected file paths
// - Animation-ready: each activity owns its enter/exit animation state
// - Concurrent: multiple activities can run simultaneously
// - Transient: completed activities animate out, then are removed

export type ActivityKind =
  | "thinking"
  | "reasoning"
  | "reading"
  | "searching"
  | "planning"
  | "working"
  | "writing"
  | "running-command"
  | "testing"
  | "preview"
  | "complete"
  | "warning"
  | "error"

export type ActivityStatus = "pending" | "running" | "completed" | "failed"

export interface Activity {
  /** Unique identifier for this activity */
  id: string
  /** The kind of work being done — drives icon and animation */
  type: ActivityKind
  /** Short human-readable title (e.g. "Reading files…") */
  title: string
  /** Longer description with context (e.g. "Reading src/components/Header.tsx") */
  description: string
  /** Current lifecycle status */
  status: ActivityStatus
  /** Optional progress 0–100 (e.g. 45 for 45%) */
  progress?: number
  /** Optional progress detail (e.g. "3 / 16 files") */
  progressDetail?: string
  /** Timestamp when this activity was created (ms) */
  createdAt: number
  /** Timestamp when this activity started running (ms) */
  startedAt?: number
  /** Timestamp when this activity completed/failed (ms) */
  completedAt?: number
  /** Duration in ms. 0 while still running, computed on completion/failure */
  duration: number
  /** File paths affected by this activity */
  affectedFiles: string[]
  /** If this is a sub-activity, the parent activity's ID */
  parentId?: string
  /** IDs of child/sub-activities */
  children: string[]
  /** Animation state for enter/exit transitions */
  animationState: "entering" | "idle" | "exiting"
}

export type ActivityEngineEventType =
  | "activity.started"
  | "activity.updated"
  | "activity.completed"
  | "activity.failed"
  | "activity.removed"

export interface ActivityEngineEvent {
  type: ActivityEngineEventType
  activity: Activity
  /** Error message — only present when type is "activity.failed" */
  error?: string
}

export type ActivityEngineListener = (event: ActivityEngineEvent) => void

// ─── ActivityEngine class ─────────────────────────────────────────────────────
export class ActivityEngine {
  private activities: Map<string, Activity> = new Map()
  /** Ordered queue of activity IDs (oldest first) */
  private queue: string[] = []
  private listeners: Set<ActivityEngineListener> = new Set()
  private counter = 0

  // ── ID generation ─────────────────────────────────────────────────────────
  private uid(): string {
    return `act-${++this.counter}-${Date.now().toString(36)}`
  }

  // ── Internal emit ─────────────────────────────────────────────────────────
  private _emit(event: ActivityEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to all activity lifecycle events. Returns unsubscribe function. */
  subscribe(listener: ActivityEngineListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Start a new activity. Adds to the end of the queue.
   * Returns the activity ID for later updates.
   */
  start(
    type: ActivityKind,
    title: string,
    description?: string,
    affectedFiles?: string[],
    parentId?: string,
  ): string {
    const id = this.uid()
    const now = Date.now()
    const activity: Activity = {
      id,
      type,
      title,
      description: description ?? title,
      status: "running",
      createdAt: now,
      startedAt: now,
      completedAt: undefined,
      duration: 0,
      affectedFiles: affectedFiles ?? [],
      parentId,
      children: [],
      animationState: "entering",
    }

    this.activities.set(id, activity)
    this.queue.push(id)

    // Link to parent
    if (parentId) {
      const parent = this.activities.get(parentId)
      if (parent) {
        parent.children.push(id)
      }
    }

    // Transition from entering to idle after a frame
    setTimeout(() => {
      const act = this.activities.get(id)
      if (act && act.animationState === "entering") {
        act.animationState = "idle"
        this._emit({ type: "activity.updated", activity: act })
      }
    }, 0)

    this._emit({ type: "activity.started", activity })
    return id
  }

  /**
   * Update an activity's description, progress, or affected files.
   * Silently no-ops if the activity ID doesn't exist.
   */
  update(
    id: string,
    updates: Partial<Pick<Activity, "description" | "progress" | "progressDetail" | "affectedFiles">>,
  ): void {
    const activity = this.activities.get(id)
    if (!activity) return

    if (updates.description !== undefined) activity.description = updates.description
    if (updates.progress !== undefined) activity.progress = updates.progress
    if (updates.progressDetail !== undefined) activity.progressDetail = updates.progressDetail
    if (updates.affectedFiles !== undefined) activity.affectedFiles = updates.affectedFiles

    this._emit({ type: "activity.updated", activity })
  }

  /**
   * Mark an activity as completed successfully.
   * Computes duration from start time. Triggers exit animation.
   */
  complete(id: string, affectedFiles?: string[]): void {
    const activity = this.activities.get(id)
    if (!activity) return

    const startTime = activity.startedAt ?? activity.createdAt
    activity.status = "completed"
    activity.completedAt = Date.now()
    activity.duration = activity.completedAt - startTime
    if (affectedFiles) activity.affectedFiles = affectedFiles
    activity.animationState = "exiting"

    this._emit({ type: "activity.completed", activity })

    // Remove from queue after exit animation completes
    setTimeout(() => {
      this.queue = this.queue.filter((aid) => aid !== id)
      this.activities.delete(id)
      this._emit({ type: "activity.removed", activity })
    }, 500) // Match exit animation duration
  }

  /**
   * Mark an activity as failed with an error message.
   * Computes duration from start time. Triggers exit animation.
   */
  fail(id: string, error: string): void {
    const activity = this.activities.get(id)
    if (!activity) return

    const startTime = activity.startedAt ?? activity.createdAt
    activity.status = "failed"
    activity.completedAt = Date.now()
    activity.duration = activity.completedAt - startTime
    activity.animationState = "exiting"

    this._emit({ type: "activity.failed", activity, error })

    // Remove from queue after exit animation completes
    setTimeout(() => {
      this.queue = this.queue.filter((aid) => aid !== id)
      this.activities.delete(id)
      this._emit({ type: "activity.removed", activity })
    }, 500)
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  /** Get all activities in queue order (oldest first) */
  getQueue(): Activity[] {
    return this.queue.map((id) => this.activities.get(id)!).filter(Boolean)
  }

  /** Get only currently-running activities */
  getRunning(): Activity[] {
    return this.getQueue().filter((a) => a.status === "running")
  }

  /** Get a specific activity by ID */
  get(id: string): Activity | null {
    return this.activities.get(id) ?? null
  }

  /** Get the most recently started running activity */
  getCurrent(): Activity | null {
    const running = this.getRunning()
    return running.length > 0 ? running[running.length - 1] : null
  }

  /** Get all activities including completed/failed (for debugging) */
  getAll(): Activity[] {
    return Array.from(this.activities.values())
  }

  // ── Housekeeping ──────────────────────────────────────────────────────────

  /** Remove all non-running activities from the store */
  clearCompleted(): void {
    for (const [id, activity] of this.activities) {
      if (activity.status !== "running") {
        this.activities.delete(id)
        this.queue = this.queue.filter((aid) => aid !== id)
      }
    }
  }

  /** Reset the engine entirely — clears all state */
  reset(): void {
    this.activities.clear()
    this.queue = []
  }
}

/** Singleton instance — import this everywhere */
export const activityEngine = new ActivityEngine()
