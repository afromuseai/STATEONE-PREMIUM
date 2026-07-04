/**
 * STAGEONE Execution Tracer — Public API
 *
 * Single import point for all execution-tracer consumers.
 *
 * Usage:
 *   import { tracer } from '@/lib/execution-tracer'
 */

export { tracer, ExecutionTracer } from "./ExecutionTracer";
export type { TraceStageEntry } from "./ExecutionTracer";
