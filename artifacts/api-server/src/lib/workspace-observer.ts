// ─── Workspace Observer — Live Workspace State ──────────────────────────────
// Phase 13.8
//
// Maintains a live, versioned snapshot of the workspace state during execution.
// Receives notifications from the event bus and updates workspace intelligence
// incrementally. Becomes the canonical source of workspace state.
//
// The observer tracks versions for each subsystem so consumers can detect
// whether their cached data is stale.

import { logger } from "./logger";
import { workspaceEventBus, type WorkspaceEventType } from "./workspace-event-bus";
import type { WorkspaceContext } from "./workspace-context";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceSnapshot {
  /** Monotonically increasing version number. */
  version: number;
  /** ISO timestamp of the last update. */
  timestamp: string;
  /** Files that changed in the last update. */
  changedFiles: string[];
  /** Version of the import graph (incremented on each update). */
  importGraphVersion: number;
  /** Version of the component graph (incremented on each update). */
  componentGraphVersion: number;
  /** Version of the route tree (incremented on each update). */
  routeTreeVersion: number;
  /** Version of the validation state (incremented on each validation). */
  validationVersion: number;
  /** Overall confidence score (0-100). */
  confidence: number;
}

export interface LiveWorkspaceContext {
  /** The current workspace context (may be partial during incremental updates). */
  context: WorkspaceContext;
  /** The current snapshot metadata. */
  snapshot: WorkspaceSnapshot;
  /** Files that have been modified during this execution session. */
  sessionChanges: string[];
  /** Whether the workspace is in a consistent state. */
  isConsistent: boolean;
}

// ─── Observer ────────────────────────────────────────────────────────────────

class WorkspaceObserver {
  private liveContext: LiveWorkspaceContext;
  private unsubscribers: Array<() => void> = [];

  constructor(initialContext: WorkspaceContext) {
    this.liveContext = {
      context: initialContext,
      snapshot: {
        version: 0,
        timestamp: new Date().toISOString(),
        changedFiles: [],
        importGraphVersion: 0,
        componentGraphVersion: 0,
        routeTreeVersion: 0,
        validationVersion: 0,
        confidence: 100,
      },
      sessionChanges: [],
      isConsistent: true,
    };

    this.startListening();
  }

  private startListening(): void {
    // Subscribe to file change events
    this.unsubscribers.push(
      workspaceEventBus.subscribe("FILE_CREATED", (event) => {
        const filePath = event.payload.filePath as string;
        if (filePath) {
          this.markChanged(filePath);
          this.incrementVersion();
        }
      }),
    );

    this.unsubscribers.push(
      workspaceEventBus.subscribe("FILE_UPDATED", (event) => {
        const filePath = event.payload.filePath as string;
        if (filePath) {
          this.markChanged(filePath);
          this.incrementVersion();
        }
      }),
    );

    this.unsubscribers.push(
      workspaceEventBus.subscribe("FILE_DELETED", (event) => {
        const filePath = event.payload.filePath as string;
        if (filePath) {
          this.markChanged(filePath);
          this.incrementVersion();
        }
      }),
    );

    // Subscribe to graph update events
    this.unsubscribers.push(
      workspaceEventBus.subscribe("IMPORT_GRAPH_UPDATED", () => {
        this.liveContext.snapshot.importGraphVersion++;
        this.incrementVersion();
      }),
    );

    this.unsubscribers.push(
      workspaceEventBus.subscribe("COMPONENT_GRAPH_UPDATED", () => {
        this.liveContext.snapshot.componentGraphVersion++;
        this.incrementVersion();
      }),
    );

    this.unsubscribers.push(
      workspaceEventBus.subscribe("ROUTE_GRAPH_UPDATED", () => {
        this.liveContext.snapshot.routeTreeVersion++;
        this.incrementVersion();
      }),
    );

    // Subscribe to validation events
    this.unsubscribers.push(
      workspaceEventBus.subscribe("VALIDATION_COMPLETED", (event) => {
        this.liveContext.snapshot.validationVersion++;
        const success = event.payload.success as boolean;
        if (success !== undefined) {
          this.liveContext.isConsistent = success;
        }
        this.incrementVersion();
      }),
    );

    // Subscribe to confidence changes
    this.unsubscribers.push(
      workspaceEventBus.subscribe("CONFIDENCE_CHANGED", (event) => {
        const score = event.payload.score as number;
        if (score !== undefined) {
          this.liveContext.snapshot.confidence = score;
        }
      }),
    );

    // Subscribe to task events
    this.unsubscribers.push(
      workspaceEventBus.subscribe("TASK_COMPLETED", (event) => {
        const changedFiles = event.payload.changedFiles as string[];
        if (changedFiles) {
          for (const f of changedFiles) {
            this.markChanged(f);
          }
        }
        this.incrementVersion();
      }),
    );

    this.unsubscribers.push(
      workspaceEventBus.subscribe("TASK_FAILED", (event) => {
        this.liveContext.isConsistent = false;
        this.incrementVersion();
      }),
    );
  }

  private markChanged(filePath: string): void {
    if (!this.liveContext.sessionChanges.includes(filePath)) {
      this.liveContext.sessionChanges.push(filePath);
    }
    this.liveContext.snapshot.changedFiles = [filePath];
  }

  private incrementVersion(): void {
    this.liveContext.snapshot.version++;
    this.liveContext.snapshot.timestamp = new Date().toISOString();
  }

  /** Get the current live workspace context. */
  getLiveContext(): LiveWorkspaceContext {
    return this.liveContext;
  }

  /** Get the current workspace context (convenience accessor). */
  getContext(): WorkspaceContext {
    return this.liveContext.context;
  }

  /** Get the current snapshot. */
  getSnapshot(): WorkspaceSnapshot {
    return { ...this.liveContext.snapshot };
  }

  /** Update the workspace context with new data. */
  updateContext(partial: Partial<WorkspaceContext>): void {
    this.liveContext.context = { ...this.liveContext.context, ...partial };
    this.incrementVersion();
  }

  /** Mark the workspace as consistent/inconsistent. */
  setConsistent(consistent: boolean): void {
    this.liveContext.isConsistent = consistent;
  }

  /** Reset session changes (call at start of a new execution). */
  resetSession(): void {
    this.liveContext.sessionChanges = [];
    this.liveContext.isConsistent = true;
  }

  /** Dispose the observer and unsubscribe from all events. */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createWorkspaceObserver(initialContext: WorkspaceContext): WorkspaceObserver {
  return new WorkspaceObserver(initialContext);
}
