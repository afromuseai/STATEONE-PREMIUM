// ─── Workspace Event Bus — Event-Driven Pub/Sub System ──────────────────────
// Phase 13.8
//
// Central event bus for live workspace intelligence. All subsystems communicate
// through events. No polling. No direct coupling between publishers and
// subscribers.
//
// Events:
//   FILE_CREATED, FILE_UPDATED, FILE_DELETED
//   IMPORT_GRAPH_UPDATED, COMPONENT_GRAPH_UPDATED, ROUTE_GRAPH_UPDATED
//   VALIDATION_COMPLETED, TASK_COMPLETED, TASK_FAILED
//   WORKSPACE_UPDATED, PLANNER_UPDATED, CONFIDENCE_CHANGED

import { logger } from "./logger";

// ─── Event Types ─────────────────────────────────────────────────────────────

export type WorkspaceEventType =
  | "FILE_CREATED"
  | "FILE_UPDATED"
  | "FILE_DELETED"
  | "IMPORT_GRAPH_UPDATED"
  | "COMPONENT_GRAPH_UPDATED"
  | "ROUTE_GRAPH_UPDATED"
  | "VALIDATION_COMPLETED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "WORKSPACE_UPDATED"
  | "PLANNER_UPDATED"
  | "CONFIDENCE_CHANGED"
  | "IMPACT_DETECTED";

export interface WorkspaceEvent {
  type: WorkspaceEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: WorkspaceEvent) => void | Promise<void>;

// ─── Event Bus ───────────────────────────────────────────────────────────────

class WorkspaceEventBus {
  private subscribers = new Map<WorkspaceEventType, Set<EventHandler>>();
  private history: WorkspaceEvent[] = [];
  private maxHistory = 100;

  /** Subscribe to a specific event type. */
  subscribe(eventType: WorkspaceEventType, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(handler);
    };
  }

  /** Subscribe to multiple event types. */
  subscribeMany(eventTypes: WorkspaceEventType[], handler: EventHandler): () => void {
    const unsubscribers = eventTypes.map((t) => this.subscribe(t, handler));
    return () => unsubscribers.forEach((u) => u());
  }

  /** Publish an event to all subscribers. */
  async publish(eventType: WorkspaceEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const event: WorkspaceEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Store in history
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Notify subscribers
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      const promises: Promise<void>[] = [];
      for (const handler of handlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (err) {
          logger.warn(
            { eventType, err: String(err) },
            "[workspace-event-bus] Handler error",
          );
        }
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }

    // Log activity stream events
    if (eventType !== "TASK_COMPLETED" && eventType !== "TASK_FAILED") {
      logger.info(
        { eventType, ...payload },
        `[workspace-event-bus] ${eventType}`,
      );
    }
  }

  /** Get recent event history. */
  getHistory(): WorkspaceEvent[] {
    return [...this.history];
  }

  /** Clear event history. */
  clearHistory(): void {
    this.history = [];
  }
}

// Singleton instance
export const workspaceEventBus = new WorkspaceEventBus();
