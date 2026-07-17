// ─── Website Studio Runtime Types ─────────────────────────────────────────────
// Shared types used by Website Studio UI components.
// Canonical runtime types live in WebsiteStudioRuntime.ts (WSToolCall, WSToolResult);
// this file re-exports them with friendly aliases for consumer components.

export type { WSToolCall as ToolCall, WSToolResult as ToolResult } from "./WebsiteStudioRuntime"
