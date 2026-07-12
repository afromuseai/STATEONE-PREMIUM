/**
 * Website Studio — Generation Event types.
 *
 * This is a standalone, frontend-only event contract for Website Studio's
 * own generation pipeline. It is intentionally independent of Marcus /
 * `marcus-session` — nothing here imports or depends on that system.
 *
 * These types describe events that generation-producing code *could* emit
 * in the future (e.g. a code-gen step reporting progress). Nothing emits
 * them yet — this file only defines the shape.
 */

export type GenerationEventType =
  | "GENERATION_STARTED"
  | "PLANNING_STARTED"
  | "DESIGN_STARTED"
  | "ASSET_GENERATION_STARTED"
  | "CODE_GENERATION_STARTED"
  | "REVIEW_STARTED"
  | "GENERATION_COMPLETED"
  | "GENERATION_ERROR"

export interface GenerationEventDetails {
  decision?: string
  reason?: string
  files?: string[]
}

export interface GenerationEvent {
  type: GenerationEventType
  message?: string
  details?: GenerationEventDetails
  progress?: number
  timestamp: number
}
