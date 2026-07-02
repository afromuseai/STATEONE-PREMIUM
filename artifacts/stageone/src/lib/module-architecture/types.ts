/**
 * STAGEONE Module Architecture — Shared Types
 * Phase 1: Foundation infrastructure only. No existing module uses these yet.
 */

/** Identifiers for every operational module in STAGEONE. */
export type ModuleId =
  | 'intelligence'
  | 'website'
  | 'chatbot'
  | 'automation'
  | 'orchestrator';

/** Lifecycle states a module can be in at any point in time. */
export type ModuleState =
  | 'idle'
  | 'populating'
  | 'generating'
  | 'saving'
  | 'error';

/** All supported lifecycle event types emitted by the event system. */
export type LifecycleEventType =
  | 'populate.started'
  | 'populate.complete'
  | 'generate.started'
  | 'generate.complete';

/**
 * Shared context passed into every module operation.
 * Carries the data a module needs to populate itself and run generation.
 */
export interface ModuleContext {
  moduleId: ModuleId;
  projectId?: string;
  userId?: string;
  businessIdea?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A lifecycle event emitted by the event infrastructure.
 * Payload is module-specific and typed loosely at this layer.
 */
export interface LifecycleEvent {
  type: LifecycleEventType;
  moduleId: ModuleId;
  /** Unix timestamp (ms) at the moment of emission. */
  timestamp: number;
  payload?: unknown;
}
