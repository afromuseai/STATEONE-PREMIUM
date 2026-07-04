---
name: Execution trace system (Marcus pipeline)
description: How the 12-stage execution tracer is wired across generator modules without touching business logic
---

The tracer (`@/lib/execution-tracer`, singleton `tracer`) is purely observational: `startExecution`/`getActiveExecutionId` return a traceId keyed by module ("website" | "chatbot" | "intelligence" | "automation" | "orchestrator"), `logStage` records one of 12 pipeline stages, `endExecution` is idempotent and auto-prints the full trace.

**Why:** the task explicitly forbade modifying routing/controllers/bridges/generation logic — instrumentation had to be additive-only, wrapped in `if (traceId) {...}` guards so it's a no-op when a page is used outside the Marcus/ExecutionBus flow (e.g. manual button clicks with no active trace).

**How to apply:** Stages 1-2 live in `copilot-panel.tsx` dispatch sites; 3-8 live in `ExecutionBus.ts`; 9-10 (HTTP request/response) belong in each generator page's own fetch call; 11-12 (Persistence/Completion event) are centralized in `useGeneratorOrchestration.completeGeneration` for modules that use the shared hook (chatbot, automation, website), but orchestrator.tsx and business-intelligence.tsx manage their own `ensureProject`/`emit` calls directly, so they log stage 11/12 inline instead. Always call `tracer.endExecution(traceId, false, reason)` on every catch/error branch to avoid a trace never printing.
