# Phase 15.0 — Website Studio End-to-End Engineering Verification Report

**Date:** July 21, 2026  
**Scope:** Website Studio editing pipeline only (Phase 13.0 – 14.5 subsystems)  
**Method:** Static code inspection via parallel read-only explorers across frontend and backend  

---

## Step 1 — Complete Pipeline Graph

```
User presses Send
  ↓
AgentConversation.submit()
  [artifacts/stageone/src/components/website-v2/ide/AgentConversation.tsx, L598-635]
  ↓
classifyIntent(text)
  [AgentConversation.tsx, L246-282]
  → "edit-request" | "build-request"  →  _submitEdit()
  → "conversation" | "code-question"  →  _submitConversation()  [SEE NOTE A]
  ↓  (edit path)
WebsiteStudioRuntime._submitEdit()
  [artifacts/stageone/src/components/website-v2/ide/WebsiteStudioRuntime.ts, L571-632]
  → opens SSE stream
  ↓
POST /api/website-v2/projects/:id/edit
  [artifacts/api-server/src/routes/edit-website-v2.ts]
  ↓
requireAuth middleware
  ↓
getV2Project()
  → loads project (BusinessContext, Blueprint, Files)
  ↓
WorkspaceContextBuilder.build()
  [artifacts/api-server/src/lib/workspace-context-builder.ts]
  → returns WorkspaceContext (framework, deps, importGraph, routeTree,
    componentIndex, designTokens, relatedFiles, projectMemory, …)
  ↓
SSE stream established
  ↓
emit phase: "analyzing"
  ↓
MarcusController.runEditFlow(runtime)          ← [NOTE B: Marcus backbone]
  [artifacts/api-server/src/lib/agents/marcus-controller.ts]
  UNDERSTAND → PLAN → BUILD → TEST → REPORT
  ↓
runEditingAgent()
  [artifacts/api-server/src/lib/website-v2-editor.ts]

  ├─ TimelineEngine.init()
  │    [artifacts/api-server/src/lib/timeline-engine.ts]
  │
  ├─ RecoveryEngine.snapshot()               ← pre-edit snapshot
  │    [artifacts/api-server/src/lib/recovery-engine.ts]
  │
  ├─ planExecution()  [ExecutionPlanner]
  │    [artifacts/api-server/src/lib/execution-planner.ts]
  │    → returns: { strategy, objective, predictedFiles, … }
  │    → consumed by: buildTaskPrompt(), buildUserPrompt()
  │
  ├─ runEngineeringAudit()                   ← Phase 15.1 (beyond scope, wired)
  │    [artifacts/api-server/src/lib/continuous-engineering-engine.ts]
  │    → formatEngineeringAudit() injected into prompt
  │
  ├─ evaluateProductIntelligence()            ← Phase 16.1 (beyond scope, wired)
  │    [artifacts/api-server/src/lib/product-intelligence-engine.ts]
  │    → formatProductAssessment() injected into prompt
  │
  ├─ runEngineeringAdvisor()                  ← Phase 16.2 (beyond scope, wired)
  │    [artifacts/api-server/src/lib/engineering-advisor.ts]
  │    → formatEngineeringAdvisor() injected into prompt
  │
  ├─ generateEngineeringRoadmap()             ← Phase 16.3 (beyond scope, wired)
  │    [artifacts/api-server/src/lib/engineering-roadmap-engine.ts]
  │    → formatEngineeringRoadmap() injected into prompt
  │
  ├─ evaluateEngineeringDecision()
  │    [artifacts/api-server/src/lib/engineering-decision-engine.ts]
  │    → formatEngineeringDecision() injected into prompt
  │
  ├─ planTasks()  [TaskPlanner]
  │    [artifacts/api-server/src/lib/task-planner.ts]
  │    → returns: ExecutionTask[]
  │    → consumed by: per-task agent execution loop
  │
  ├─ FOR EACH ExecutionTask:
  │   ├─ routeTask()  [AgentRouter]
  │   │    [artifacts/api-server/src/lib/agent-router.ts]
  │   │    → scores 9 agent types (keyword + extension + strategy + perf bonus)
  │   │    → selects: styling | routing | component | state | data |
  │   │               performance | accessibility | validation | general
  │   │    → changes: systemPrompt, filteredWorkspaceContext
  │   │
  │   ├─ retrieveSpecialistMemories()
  │   │    [artifacts/api-server/src/lib/specialist-memory.ts]
  │   │    → returns past learnings for selected agent
  │   │    → injected as "## Specialist Memory" section in buildTaskPrompt()
  │   │
  │   ├─ buildTaskPrompt()
  │   │    → sections: BusinessContext, Blueprint, WorkspaceContext,
  │   │                Decision, Audit, Assessment, Advisor, Roadmap,
  │   │                ExecutionPlan, SpecialistMemory, Files, Instruction
  │   │
  │   └─ streamNvidia()  [LLM]
  │        → streams agent response (file modifications, narration)
  │
  ├─ merge()
  │    → collects file modification results from all tasks
  │
  ├─ validation (TypeScript / ESLint / Build via detectValidators)
  │    → returns ValidationReport { success, errors[] }
  │
  ├─ IF validation fails:
  │   ├─ repair loop (max N attempts)
  │   └─ RecoveryEngine.rollback()
  │        → returns FileModification[] (restoration set)
  │        → caller applies file writes
  │
  ├─ ConfidenceEngine.compute()
  │    [artifacts/api-server/src/lib/confidence-engine.ts]
  │    → dynamic formula; score emitted via SSE "confidence" phase
  │
  ├─ PreviewIntelligenceEngine.analyzePreviewState()
  │    [artifacts/api-server/src/lib/preview-intelligence-engine.ts]
  │    → static analysis only (not real browser render)
  │    → emitted via SSE "preview" and "visual" phases
  │
  ├─ extractSpecialistMemories() / reinforceSpecialistMemories()
  │    → captures new patterns; updates specialist memory DB
  │
  └─ executeLearningLoop()
       [artifacts/api-server/src/lib/learning-loop.ts]
       → runs AFTER execution completes
       → writes to analytics files; updates policies/rankings for FUTURE runs

  ↓
emit phases: "changes", "saved", "timeline", "confidence", "preview",
             "visual", "recovery", "decision", "audit", "product",
             "advisor", "roadmap", "regenerating", "preview-ready"
  ↓
ImportGraphBuilder / ComponentIndexBuilder / RouteTreeBuilder.invalidate()
  ↓ (SSE stream to frontend)
WebsiteStudioRuntime.onEditSseEvent()
  [WebsiteStudioRuntime.ts, L635-731]
  → maps each phase to wsRuntimeEmitter events
  ↓
UI Panel updates:
  ├─ EngineeringTimeline.tsx     ← "timeline" events
  ├─ EngineeringConfidencePanel.tsx  ← "confidence" events
  ├─ EngineeringRecoveryPanel.tsx    ← "recovery" events
  ├─ EngineeringDecisionPanel.tsx    ← "decision" events
  ├─ EngineeringAuditPanel.tsx       ← "audit" events
  ├─ File tree                        ← "changes" events
  └─ AgentConversation (chat)         ← streaming narration
  ↓
Completion
```

**NOTE A — Conversation path leakage:** When `classifyIntent` returns `"conversation"` or `"code-question"`, `_submitConversation` calls `POST /api/copilot/agent` — the Marcus Copilot endpoint — not a Website Studio–specific endpoint. The editing UI can enter a Marcus Copilot session mid-flow.

**NOTE B — Marcus backbone:** `edit-website-v2.ts` instantiates `MarcusTaskBus` and `MarcusConversationEngine` per request, then delegates the entire edit pipeline to `MarcusController.runEditFlow()`. The Website Studio edit pipeline runs on the Marcus runtime (see Step 12).

---

## Step 2 — Wiring Verification

| System | Exists | Called | Return Used | Affects Execution | UI Visible | Status |
|---|---|---|---|---|---|---|
| WorkspaceContextBuilder | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| ExecutionPlanner | PASS | PASS | PASS | PASS | PASS | **PASS** |
| TaskPlanner | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| AgentRouter (9 types) | PASS | PASS | PASS | PASS | PASS | **PASS** |
| SpecialistMemory | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| LLM (streamNvidia) | PASS | PASS | PASS | PASS | PASS | **PASS** |
| TimelineEngine | PASS | PASS | PASS | PASS | PASS | **PASS** |
| RecoveryEngine (snapshot) | PASS | PASS | PASS | PASS | PASS | **PASS** |
| RecoveryEngine (rollback) | PASS | PASS | PARTIAL | PARTIAL | PASS | **PARTIAL** |
| ConfidenceEngine | PASS | PASS | PASS | PASS | PASS | **PASS** |
| PreviewIntelligenceEngine | PASS | PASS | PARTIAL | PARTIAL | PASS | **PARTIAL** |
| EngineeringDecisionEngine | PASS | PASS | PASS | PASS | PASS | **PASS** |
| ContinuousEngineeringEngine (Audit) | PASS | PASS | PASS | PASS | PASS | **PASS** |
| ProductIntelligenceEngine | PASS | PASS | PASS | PASS | PASS | **PASS** |
| EngineeringAdvisor | PASS | PASS | PASS | PASS | PASS | **PASS** |
| EngineeringRoadmapEngine | PASS | PASS | PASS | PASS | PASS | **PASS** |
| ExecutionAnalytics | PASS | PASS | PASS | PASS (future) | FAIL | **PARTIAL** |
| AgentPerformanceProfiler | PASS | PASS | PASS | PASS | FAIL | **PASS** |
| PolicyEngine | PASS | PASS | PARTIAL | PARTIAL | FAIL | **PARTIAL** |
| RepairStrategyOptimizer | PASS | PASS | FAIL | FAIL | FAIL | **UNUSED** |
| ValidationPatternLearner | PASS | PASS | FAIL | FAIL | FAIL | **UNUSED** |
| ConflictAnalytics | PASS | PASS | FAIL | FAIL | FAIL | **UNUSED** |
| AdaptiveConfidence | PASS | PASS | FAIL | FAIL | FAIL | **UNUSED** |
| LearningLoop | PASS | PASS | PARTIAL | PASS (future) | FAIL | **PARTIAL** |
| Intent Classifier | PASS | PASS | PASS | PASS | FAIL | **PASS** |
| MarcusController (edit backbone) | PASS | PASS | PASS | PASS | FAIL | **PASS** |

---

## Step 3 — Dead Code Audit

| Location | Issue | Category |
|---|---|---|
| `adaptive-confidence.ts` → `computeAdaptiveConfidence()` | Method exists, never called in editor pipeline; system records telemetry but its output never adjusts confidence thresholds | Computed but ignored |
| `validation-pattern-learner.ts` → `buildValidationFailureHint()` | Method exists to enhance repair prompts with historical error context; never called in repair loop | Computed but ignored |
| `repair-strategy-optimizer.ts` → `getAverageRepairSuccessRate()` | Data persisted; learning-loop reads it; but repair prompts are never modified based on the result | Telemetry only |
| `execution-policy-engine.ts` → `getPreferredAgent()` / `getPreferredStrategy()` | Policy methods exist and policies are evolved by learning-loop; not called inside AgentRouter or TaskPlanner for live routing decisions | Instantiated but unused |
| `merge-conflict-analytics.ts` → `getTotalMergeConflicts()` | Data written on conflicts; read by learning-loop; but no downstream code gates behavior on conflict frequency | Telemetry only |
| `EngineeringRecoveryPanel.tsx` — manual rollback button | No user-triggered rollback API endpoint exists; recovery is autonomous only; UI suggests user control that doesn't exist | Placeholder UI |
| `MarcusConversationEngine` instance in `edit-website-v2.ts` | Instantiated on every edit request (L82) alongside `MarcusTaskBus`; verify whether `engine` is actually used inside `runEditFlow` or is only a structural requirement of the runtime interface | Potentially unused instance |

---

## Step 4 — Prompt Verification

Verified against `buildUserPrompt()` and `buildTaskPrompt()` in `artifacts/api-server/src/lib/website-v2-editor.ts`.

| Prompt Section | Field Source | Status |
|---|---|---|
| Workspace Context (framework, deps, tooling) | `WorkspaceContext` via `formatWorkspaceContext()` | **INCLUDED** (nullable) |
| Execution Plan (strategy, objective, tasks) | `ExecutionPlanner` output | **INCLUDED** (nullable) |
| Specialist Memory | `retrieveSpecialistMemories()` for selected agent | **INCLUDED** in `executeTask` only (nullable) |
| Project Memory | `WorkspaceContext.projectMemory` | **INCLUDED** (within WorkspaceContext) |
| Design Tokens | `WorkspaceContext.designTokens` (L1514, L1592) | **INCLUDED** (nullable) |
| Related Files | `WorkspaceContext.relatedFiles` | **INCLUDED** (within WorkspaceContext) |
| Execution Tasks | `planTasks()` → `ExecutionTask[]` | **INCLUDED** |
| Engineering Decision | `formatEngineeringDecision()` | **INCLUDED** (nullable) |
| Engineering Audit | `formatEngineeringAudit()` | **INCLUDED** (nullable) |
| Product Assessment | `formatProductAssessment()` | **INCLUDED** (nullable) |
| Engineering Advisor | `formatEngineeringAdvisor()` | **INCLUDED** (nullable) |
| Engineering Roadmap | `formatEngineeringRoadmap()` | **INCLUDED** (nullable) |
| Business Context | Injected from project record | **INCLUDED** |
| Blueprint | Injected from project record | **INCLUDED** (nullable) |
| Component Intelligence | `componentIndex` within WorkspaceContext; no dedicated "Component Intelligence" block | **PARTIALLY INCLUDED** |
| Route Intelligence | `routeTree` within WorkspaceContext; no dedicated "Route Intelligence" block | **PARTIALLY INCLUDED** |
| Import Graph | `importGraph` within WorkspaceContext | **INCLUDED** (within WorkspaceContext) |

**Summary:** All major context blocks are injected. "Component Intelligence" and "Route Intelligence" are present as sub-fields of WorkspaceContext rather than as dedicated top-level prompt sections — the data reaches the LLM but without explicit labelling that would help the model weight it.

---

## Step 5 — Agent Verification

All 9 agents are defined in `artifacts/api-server/src/lib/agent-registry.ts`.

| Agent | Router Can Select | Prompt Changes | Filtered Context | Specialist Memory Loads | Repair Loop Preserves | Telemetry Records |
|---|---|---|---|---|---|---|
| Styling | PASS | PASS (unique systemPrompt) | PASS | PASS | UNVERIFIED | PASS |
| Routing | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| Component | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| State | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| Data | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| Performance | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| Accessibility | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| Validation | PASS | PASS | PASS | PASS | UNVERIFIED | PASS |
| General | PASS (fallback) | PASS | PASS | PASS | UNVERIFIED | PASS |

**Repair loop / agent preservation:** The recovery/repair flow in `runEditingAgent` was not confirmed to re-use the originally routed agent type during retries. The repair prompt may use the general agent rather than the specialist. Mark **UNVERIFIED** until confirmed in `website-v2-editor.ts` repair retry block.

**AgentRouter selection formula:** keyword match score + file extension boost + strategy boost + `getAgentSuccessRate()` historical bonus (up to +3 points from `AgentPerformanceProfiler`). Agent selection is real and deterministic.

---

## Step 6 — Workspace Context Verification

All fields built by `WorkspaceContextBuilder` (`artifacts/api-server/src/lib/workspace-context-builder.ts`):

| Field | Built | Consumed By | Status |
|---|---|---|---|
| `framework` | PASS | ExecutionPlanner, prompt | **USED** |
| `packageManager` | PASS | Prompt | **USED** |
| `stylingApproach` | PASS | ExecutionPlanner, AgentRouter | **USED** |
| `dependencies` | PASS | Prompt, ExecutionPlanner | **USED** |
| `tooling` | PASS | Prompt | **USED** |
| `entryPoints` | PASS | Prompt | **USED** |
| `pathAliases` | PASS | Prompt | **USED** |
| `importGraph` | PASS | ExecutionPlanner, ConfidenceEngine | **USED** |
| `danglingImports` | PASS | ConfidenceEngine | **USED** |
| `selectedFiles` | PASS | Prompt (file injection) | **USED** |
| `relatedFiles` | PASS | Prompt | **USED** |
| `relationReasons` | PASS | Prompt (with relatedFiles) | **USED** |
| `componentIndex` | PASS | ConfidenceEngine, ExecutionPlanner | **USED** |
| `componentUsage` | PASS | Within componentIndex | **USED** |
| `routeTree` | PASS | ExecutionPlanner, ConfidenceEngine | **USED** |
| `layoutHierarchy` | PASS | Prompt | **USED** |
| `designTokens` | PASS | Prompt (L1514, L1592), PreviewEngine | **USED** |
| `projectMemory` | PASS | Prompt | **USED** |
| `recentChanges` | PASS | Prompt / ExecutionPlanner | **USED** |
| `acceptedPatterns` | PASS | SpecialistMemory context | **USED** |
| `rejectedPatterns` | PASS | SpecialistMemory context | **USED** |
| `availableValidators` | PASS | Repair loop (detectValidators) | **USED** |

No fields in WorkspaceContext were found to be built but never consumed.

---

## Step 7 — Timeline Verification

Timeline events sourced from `artifacts/api-server/src/lib/timeline-engine.ts`, consumed by `EngineeringTimeline.tsx`.

| Timeline Stage | Basis | Classification |
|---|---|---|
| "Workspace Analysis" | Emitted after `WorkspaceContextBuilder.build()` returns | **Actual execution** |
| "Execution Planning" | Emitted after `planExecution()` returns | **Actual execution** |
| "Engineering Decision" | Emitted after `evaluateEngineeringDecision()` returns | **Actual execution** |
| "Task Planning" | Emitted after `planTasks()` returns | **Actual execution** |
| "Agent Routing" | Emitted after `routeTask()` returns | **Actual execution** |
| "Specialist Memory" | Emitted after `retrieveSpecialistMemories()` returns | **Actual execution** |
| "LLM Generation" | Emitted at stream start/end | **Actual execution** |
| "Validation" | Emitted after validation run | **Actual execution** |
| "Recovery" | Emitted after rollback (if triggered) | **Actual execution** |
| "Confidence Scoring" | Emitted after `ConfidenceEngine.compute()` | **Actual execution** |
| "Preview Analysis" | Emitted after `PreviewIntelligenceEngine.analyzePreviewState()` | **Actual execution** |
| Pending placeholders (frontend) | `DEFAULT_STEP_TYPES` rendered as "pending" in `EngineeringTimeline.tsx` before corresponding SSE arrives | **Optimistic UI (layout only)** |

**Finding:** Timeline status transitions ("running", "completed", "failed") are strictly SSE-driven. The pending-placeholder layout is a cosmetic rendering choice, not fake progress. No fake progress detected.

---

## Step 8 — Confidence Verification

Source: `artifacts/api-server/src/lib/confidence-engine.ts`

| Signal | Weight | Is Dynamic? |
|---|---|---|
| `validation_passed` | +30 | Yes — requires actual validation run |
| `validation_failed` | −40 | Yes |
| `imports_resolved` | +15 | Yes — from importGraph |
| `imports_unresolved` | −20 | Yes |
| `routes_valid` | +10 | Yes — from routeTree |
| `components_exist` | +10 | Yes — from componentIndex |
| `duplicate_detected` | −15 | Yes |
| `repair_performed` | −10 per attempt | Yes |
| `high_impact` (impactScore > 50) | −10 | Yes |
| `AdaptiveConfidence` learning signal | Intended | **CONSTANT — `computeAdaptiveConfidence()` uncalled** |

**Finding:** 8 of 9 confidence signals are dynamic. The `AdaptiveConfidence` learning signal is the only constant (its method is never invoked), so the engine always runs without the learning-adjusted baseline. This is the sole confidence signal gap.

**Threshold enforcement:** If the score falls below `EXTRA_REPAIR_THRESHOLD`, additional recovery/repair logic is triggered — the score is not cosmetic.

---

## Step 9 — Recovery Verification

Source: `artifacts/api-server/src/lib/recovery-engine.ts`

| Step | File | Status |
|---|---|---|
| Snapshot creation | `RecoveryEngine.snapshot()` called before first file write in `runEditingAgent` | **PASS** |
| Failure detection | `validationReport.success === false` after max repair attempts | **PASS** |
| Rollback execution | `RecoveryEngine.rollback()` computes `FileModification[]` diff vs snapshot | **PASS** |
| Workspace restore | Caller (`runEditingAgent` / route handler) must apply returned `FileModification[]` to DB; no explicit verify step inside RecoveryEngine | **PARTIAL** |
| UI update | SSE `recovery` phase emitted with file list and trigger reason | **PASS** |

**Finding:** Rollback correctly generates the restoration set. The `recovery-engine.ts` does not itself write to storage — it returns the diff and trusts the caller. There is no post-restore verification step (re-running validation on the rolled-back state) inside the engine. Whether the caller always applies the changes is **UNVERIFIED** without tracing the route handler's result handling.

---

## Step 10 — Learning Verification

All systems use flat-file persistence (`data/analytics/*.json`) — state survives server restarts.

| System | Data Stored | Data Read Back | Influences Future Execution | Status |
|---|---|---|---|---|
| ExecutionAnalytics | Yes (execution history) | Yes — `getExecutionHistory()` in LearningLoop | Via LearningLoop → policy/ranking updates | **PARTIAL** (indirect) |
| AgentPerformanceProfiler | Yes (rankings in `agent-performance.json`) | Yes — `getAgentSuccessRate()` in AgentRouter | **Directly** — adds up to +3 routing bonus | **PASS** |
| PolicyEngine | Yes (`execution-policies.json`) | Yes — `getPreferredAgent/Strategy()` exist | Methods not called in main routing path | **PARTIAL** |
| RepairStrategyOptimizer | Yes (`repair-performance.json`) | Read by LearningLoop only | Repair prompts never modified from stored data | **UNUSED** |
| ValidationPatternLearner | Yes (`validation-patterns.json`) | `buildValidationFailureHint()` exists but uncalled | Repair prompts never enhanced with hints | **UNUSED** |
| ConflictAnalytics | Yes (`merge-conflicts.json`) | Read by LearningLoop only | No behavior gated on conflict count | **UNUSED** |
| AdaptiveConfidence | Yes (`adaptive-confidence.json`) | `computeAdaptiveConfidence()` uncalled | Never adjusts confidence thresholds | **UNUSED** |
| LearningLoop | Orchestrator | Reads all above | Runs POST-execution; updates policies/rankings for next request | **PARTIAL** |

**Finding:** Only `AgentPerformanceProfiler` directly influences live execution (routing score). All other learning systems either feed the LearningLoop indirectly (future effect) or are telemetry-only. Four systems (`RepairStrategyOptimizer`, `ValidationPatternLearner`, `AdaptiveConfidence`, `ConflictAnalytics`) store data that is never read back to change any behavior.

---

## Step 11 — Frontend UX Audit

### Mode Classification

| Behavior | Observed |
|---|---|
| File tree (Engineering IDE) | Yes — `StudioShell.tsx` includes sidebar file browser |
| Timeline panel (Engineering IDE) | Yes — `EngineeringTimeline.tsx` |
| Confidence panel (Engineering IDE) | Yes — `EngineeringConfidencePanel.tsx` |
| Recovery panel (Engineering IDE) | Yes — `EngineeringRecoveryPanel.tsx` |
| Audit / Decision / Product / Advisor / Roadmap panels | Yes — wired to SSE |
| Chat/conversation thread | Yes — `AgentConversation.tsx` is the primary input |
| "Send" drives both chat and edits from same input box | Yes |

**UX verdict:** The UI is an **Engineering IDE wrapped around a chat interface.** The single input box conflates three distinct modes (conversation, code-question, edit-request). The user cannot tell which mode will trigger which backend. There is no mode indicator.

### Specific Inconsistencies

1. **Single input for three behaviors** — `AgentConversation.tsx` uses `classifyIntent()` to silently decide between Marcus Copilot, conversation, and Website Studio edit pipeline. The user receives no feedback about which path was taken.

2. **No manual rollback trigger** — `EngineeringRecoveryPanel.tsx` displays rollback status and file lists but provides no button to manually trigger a rollback. Recovery is fully autonomous. The UI implies user agency that doesn't exist.

3. **Activity labels mix register** — Labels include "Thinking…", "Reasoning…", "Writing files…" (engineering IDE language) alongside legacy Marcus-style labels. `AgentConversation.tsx` L645 admits phase strings are "forwarded straight from Marcus's" activity system.

4. **Conversation routing goes to Marcus Copilot** — When intent is classified as `"conversation"`, the runtime calls `POST /api/copilot/agent` — the general Marcus Copilot endpoint — not the Website Studio edit endpoint. From the user's perspective they are in Website Studio; from the server's perspective they entered Marcus Chat. No UX signal distinguishes this.

5. **EngineeringCommandCenter.tsx** (`artifacts/stageone/src/components/website-studio/EngineeringCommandCenter.tsx`) aggregates all panels in Compact/Expanded/Focus modes. This component is from Phase 15.2 and is wired to the SSE bus correctly, but its relationship to the older individual panels (`website-v2/ide/`) creates potential for duplicate rendering if both are mounted.

---

## Step 12 — Marcus Leakage Audit

### Backend

| Location | Leak | Detail |
|---|---|---|
| `edit-website-v2.ts` L4–13 | Marcus architecture comment | Header documents "MarcusConversationEngine backbone", "MarcusTaskBus / MarcusConversationEngine backbone" as the runtime for Website Studio editing |
| `edit-website-v2.ts` L30–32 | Marcus imports | `import { MarcusConversationEngine }`, `import { MarcusTaskBus }`, `import { MarcusController }` |
| `edit-website-v2.ts` L81–82 | Marcus instantiation per request | `const bus = new MarcusTaskBus(); const engine = new MarcusConversationEngine();` |
| `edit-website-v2.ts` L168 | Marcus is the pipeline entry | `MarcusController.runEditFlow(...)` is the sole execution entry; the "Website Studio edit pipeline" is entirely owned by Marcus |
| `artifacts/api-server/src/lib/agents/marcus-controller.ts` | Marcus UNDERSTAND→PLAN→BUILD→TEST→REPORT | The editing lifecycle is the Marcus agent loop, not a Website Studio–specific controller |

**Summary:** The Website Studio edit pipeline is not a standalone system — it runs on the Marcus runtime. Every edit request creates a `MarcusTaskBus` and `MarcusConversationEngine`. `MarcusController.runEditFlow` is the actual orchestrator. This is architectural leakage, not a surface string leak.

### Frontend

| Location | Leak | Detail |
|---|---|---|
| `AgentConversation.tsx` L327 | Marcus identity copy | "Marcus applies every change as it happens, the same way Replit's agent does" — user-visible description of the editing agent |
| `AgentConversation.tsx` L645 | Marcus activity labels | "both are forwarded straight from Marcus's" activity label system |
| `AgentConversation.tsx` L402 | Marcus bus comment | "Website Studio's own generation activity bus — independent of Marcus" — the comment claims independence, but the backend is Marcus-owned |
| `AgentConversation.tsx` L16 | Marcus bus comment | "independent event bus, not Marcus" — same discrepancy |
| `_submitConversation()` | Marcus Copilot endpoint | Conversation / code-question paths call `POST /api/copilot/agent` — the Marcus Copilot endpoint — inside Website Studio |

---

## Step 13 — Final Engineering Report

### ✅ Verified Working Systems

- **WorkspaceContextBuilder** — fully wired; all 21 fields built and consumed downstream
- **ExecutionPlanner** — called, output injected into prompt and consumed by TaskPlanner
- **TaskPlanner** — called, `ExecutionTask[]` drives per-task agent execution
- **AgentRouter** — all 9 agents selectable; selection formula deterministic; different system prompts per agent confirmed
- **SpecialistMemory** — loaded per agent and injected into `buildTaskPrompt()`
- **LLM (streamNvidia)** — called per task; response streamed to file modifications and narration
- **TimelineEngine** — all stages emitted at real execution checkpoints; no fake progress
- **ConfidenceEngine** — dynamic formula with 8 active signals; score gates repair triggers
- **RecoveryEngine (snapshot + rollback)** — snapshot pre-edit; rollback on validation failure; restoration set returned
- **AgentPerformanceProfiler** — rankings loaded by AgentRouter and directly influence agent selection score
- **EngineeringDecisionEngine** — called, formatted, injected into prompt, SSE-emitted, UI-visible
- **ContinuousEngineeringEngine (Audit)** — called, formatted, injected, visible
- **ProductIntelligenceEngine** — called, formatted, injected, visible
- **EngineeringAdvisor** — called, formatted, injected, visible
- **EngineeringRoadmapEngine** — called, formatted, injected, visible
- **All SSE phases** — `analyzing, editing, changes, saved, timeline, confidence, preview, visual, recovery, decision, audit, product, advisor, roadmap, regenerating, preview-ready` — all handled by `onEditSseEvent` and forwarded to UI
- **Intent classifier** — routes edit-request/build-request to edit pipeline; conversation/code-question to copilot

### ⚠️ Partially Working Systems

- **RecoveryEngine (workspace restore)** — rollback diff is computed correctly but there is no post-rollback validation pass and no explicit verify that the caller applied all file writes
- **PreviewIntelligenceEngine** — runs real static analysis (unsafe refs, missing keys, broken exports) but does not perform actual browser rendering; labeled "visual verification" in UI
- **PolicyEngine** — policies are stored and evolved by LearningLoop; `getPreferredAgent/Strategy()` methods exist but are not called inside the main routing or task-planning path
- **LearningLoop** — runs post-execution; AgentProfiler rankings reach AgentRouter correctly; policy and other outputs are available for future runs but only one consumer (AgentRouter) actively reads them
- **ExecutionAnalytics** — data written and read by LearningLoop which produces `improvementScore`; that score is used to update policies, but policy consumption is partial (see PolicyEngine above)
- **Prompt "Component Intelligence" / "Route Intelligence"** — data present in WorkspaceContext sub-fields but not as dedicated labeled prompt sections

### ❌ Broken Wiring

- **Conversation routing in Website Studio** — `classifyIntent("conversation")` calls `POST /api/copilot/agent` (Marcus Copilot), not the Website Studio edit endpoint. Users in Website Studio enter Marcus Chat without any UX signal.
- **AdaptiveConfidence → ConfidenceEngine** — `computeAdaptiveConfidence()` is never called; confidence engine always runs without its learning-adjusted baseline
- **ValidationPatternLearner → repair prompts** — `buildValidationFailureHint()` is never called in the repair loop; historical error context never enhances repair prompts
- **PolicyEngine → AgentRouter/TaskPlanner** — `getPreferredAgent/Strategy()` exist but are not invoked during live routing

### 🗑️ Unused Systems (Telemetry Without Functionality)

- **RepairStrategyOptimizer** — records repair prompts and success rates; stored data is never read back to modify any repair prompt
- **ValidationPatternLearner** — categorizes validation errors; `buildValidationFailureHint()` uncalled
- **ConflictAnalytics** — tracks merge conflict frequency; no behavior gated on conflict count
- **AdaptiveConfidence** — tracks learning iterations and writes to file; `computeAdaptiveConfidence()` never called
- **Manual rollback UI** — `EngineeringRecoveryPanel.tsx` shows rollback status without any user-triggered rollback endpoint

### 💀 Dead Code

| Item | File | Issue |
|---|---|---|
| `computeAdaptiveConfidence()` | `adaptive-confidence.ts` | Exists, never invoked |
| `buildValidationFailureHint()` | `validation-pattern-learner.ts` | Exists, never invoked |
| `getPreferredAgent()` / `getPreferredStrategy()` | `execution-policy-engine.ts` | Exists, never called in routing |
| `MarcusConversationEngine` instance | `edit-website-v2.ts` L82 | Instantiated per request; verify whether `runEditFlow` actually uses it or only needs the bus |

### 🎭 Frontend UX Problems

1. **Invisible mode switching** — one input box, three backend behaviors; no indicator of which was triggered
2. **No manual rollback** — Recovery panel implies user control; no rollback API endpoint exists
3. **Marcus copy in Website Studio** — L327 "Marcus applies every change" is user-visible and breaks the Website Studio identity
4. **Activity labels sourced from Marcus** — L645 "forwarded straight from Marcus's" system; labels are not Website Studio–native
5. **EngineeringCommandCenter vs individual panels** — Phase 15.2 dashboard and older `website-v2/ide/` panels may both be mounted; potential duplicate rendering

### 📋 Prompt Problems

1. **Component Intelligence / Route Intelligence** — present only as unnamed sub-fields of WorkspaceContext; not surfaced as labeled sections for the LLM
2. **All nullable sections** — WorkspaceContext, ExecutionPlan, Specialist Memory, and all intelligence blocks are nullable; if any upstream builder fails silently, the prompt degrades without error

### ⚡ Performance Bottlenecks

1. **LLM called per-task sequentially** (unless task parallelism is configured in PolicyEngine) — for multi-task edits this is the dominant latency
2. **`WorkspaceContextBuilder.build()`** — full workspace scan (importGraph + componentIndex + routeTree) on every edit request; results invalidated at the end of each edit; no per-request caching verified
3. **`runEngineeringAudit`, `evaluateProductIntelligence`, `runEngineeringAdvisor`, `generateEngineeringRoadmap`** — four additional inference/analysis calls before the main LLM edit; all run in series before `planTasks`

### 🔥 Highest Priority Fixes

| Priority | Finding | Location |
|---|---|---|
| P0 | Marcus backbone owns Website Studio edit — `MarcusController.runEditFlow` is the pipeline; no standalone Website Studio controller exists | `edit-website-v2.ts` L168 |
| P0 | Conversation path inside Website Studio routes to Marcus Copilot (`/api/copilot/agent`), not Website Studio | `WebsiteStudioRuntime.ts` `_submitConversation` |
| P1 | `AdaptiveConfidence.computeAdaptiveConfidence()` uncalled — confidence score always runs without learning baseline | `adaptive-confidence.ts` / `confidence-engine.ts` |
| P1 | `ValidationPatternLearner.buildValidationFailureHint()` uncalled — repair prompts never use historical error context | `validation-pattern-learner.ts` / repair loop |
| P1 | `PolicyEngine.getPreferredAgent/Strategy()` uncalled in routing — evolved policies have no live effect | `execution-policy-engine.ts` / `agent-router.ts` |
| P2 | No post-rollback validation — recovery restores files without re-running validators to confirm success | `recovery-engine.ts` |
| P2 | No manual rollback endpoint — `EngineeringRecoveryPanel` implies control that doesn't exist | `edit-website-v2.ts` (missing route) |
| P2 | "Marcus applies changes" copy user-visible in Website Studio | `AgentConversation.tsx` L327 |
| P3 | Component Intelligence / Route Intelligence not labeled as dedicated prompt sections | `website-v2-editor.ts` `buildTaskPrompt()` |
| P3 | Repair loop agent-type preservation during retries unverified | `website-v2-editor.ts` repair block |

---

*Every finding references the actual file and function where it was verified. Systems that could not be confirmed executed are marked UNVERIFIED rather than assumed working.*
