# Phase S1 — Website Studio Conversation Isolation Report

**Date:** July 21, 2026  
**Method:** Static code inspection — no code was modified during this audit.

---

## Step 1 — Complete Request Flow

### Three Distinct Execution Paths

```
User types into AgentConversation input
  ↓
classifyIntent(text)
  [AgentConversation.tsx L246-282 — regex on lowercased text]
  │
  ├── "conversation" | "code-question"
  │       ↓
  │   WebsiteStudioRuntime._submitConversation()
  │   [WebsiteStudioRuntime.ts L458-568]
  │       ↓
  │   POST /api/copilot/agent
  │   [artifacts/api-server/src/routes/copilot-agent.ts]
  │   middleware: requireAuth
  │       ↓
  │   buildWebsiteStudioConversationPrompt(projectMemory)
  │   [artifacts/api-server/src/ai/website-studio-ai.ts]
  │   identity: WEBSITE_STUDIO_AI_IDENTITY  ← CLEAN
  │       ↓
  │   streamNvidia(MODELS.AGENT_PLANNING, temperature=0.7)
  │       ↓
  │   SSE: thinking → text → done | error
  │       ↓
  │   Frontend: streaming markdown in AgentConversation chat
  │
  ├── "edit-request" | "build-request" (and default fallback)
  │       ↓
  │   WebsiteStudioRuntime._submitEdit()
  │   [WebsiteStudioRuntime.ts L571-632]
  │       ↓
  │   POST /api/website-v2/projects/:id/edit
  │   [artifacts/api-server/src/routes/edit-website-v2.ts]
  │   middleware: requireAuth
  │       ↓
  │   WorkspaceContextBuilder.build()
  │       ↓
  │   MarcusController.runEditFlow()          ← Marcus backbone
  │   [artifacts/api-server/src/lib/agents/marcus-controller.ts]
  │   instantiates: MarcusTaskBus, MarcusConversationEngine
  │       ↓
  │   runEditingAgent()
  │   [artifacts/api-server/src/lib/website-v2-editor.ts]
  │   system prompt: MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT  ← "You are Marcus"
  │       ↓
  │   streamNvidia(MODELS.WEBSITE_V2_EDITOR)
  │       ↓
  │   SSE: analyzing → editing → agent → changes → saved
  │        → timeline → confidence → preview → visual → recovery
  │        → decision → audit → product → advisor → roadmap
  │        → regenerating → preview-ready
  │       ↓
  │   Frontend: engineering panels + file tree + streaming narration
  │
  └── Generation (initial website creation, separate flow)
          ↓
      POST /api/generate/website-v2
      [artifacts/api-server/src/routes/generate-website-v2.ts]
          ↓
      MarcusController.runWebsiteGeneration()    ← Marcus backbone
          ↓
      MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT (architect phase)
      MARCUS_SYSTEM_PROMPT in marcus-stream-agent.ts (plan/execute phase)
      — both say "You are Marcus"
          ↓
      SSE: start → project-created → thinking → architect → agent → done
```

---

## Step 2 — Route Verification

| Route | Called from WS? | Passes through Marcus? | Why | Intentional? | Required? | Leaks Marcus behavior? |
|---|---|---|---|---|---|---|
| `POST /api/copilot/agent` | YES (conversation path) | NO | Uses `WEBSITE_STUDIO_AI_IDENTITY` only; no MarcusController, no MarcusConversationEngine | Yes | No — route name is misleading ("copilot") but implementation is clean | **NO** |
| `POST /api/website-v2/projects/:id/edit` | YES (edit path) | **YES** — `MarcusController.runEditFlow()`, `MarcusTaskBus`, `MarcusConversationEngine` all instantiated | MarcusController owns UNDERSTAND→PLAN→BUILD→TEST→REPORT loop | Architectural decision | Not required — no Website Studio–native controller exists yet | **YES** — system prompt says "You are Marcus" |
| `POST /api/generate/website-v2` | YES (generation path) | **YES** — `MarcusController.runWebsiteGeneration()` | MarcusController owns generation pipeline | Architectural decision | Not required | **YES** — both MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT and MARCUS_SYSTEM_PROMPT say "You are Marcus" |
| `POST /api/copilot` (general Marcus Copilot) | **NO** | YES (it is Marcus) | General platform copilot; different product | N/A | N/A | Not reachable from Website Studio frontend |
| `POST /api/copilot/code-review` | NO | No | Code review agent; not triggered from WS | N/A | N/A | N/A |

**Key finding:** The general Marcus Copilot endpoint (`POST /api/copilot`) is **never called** from Website Studio. The route that handles Website Studio conversation (`POST /api/copilot/agent`) is correctly isolated despite its misleading name. The leak is entirely in the edit and generation execution paths.

---

## Step 3 — Response Generation Verification

### A. No Website Exists — Expected: Website Studio Architect

**Actual:** `POST /api/generate/website-v2` → `MarcusController.runWebsiteGeneration()` → `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` + `MARCUS_SYSTEM_PROMPT`

Both prompts open with `"You are Marcus, an autonomous AI software engineer inside Website Studio."` and `"You are Marcus, an expert autonomous software engineer inside Website Studio."` respectively.

**Status: FAIL** — The expected Website Studio Architect is implemented as Marcus. The agent exists and functions correctly; the identity in the system prompt is wrong.

---

### B. Existing Website — Expected: Website Engineering Agent

**Actual:** `POST /api/website-v2/projects/:id/edit` → `MarcusController.runEditFlow()` → `runEditingAgent()` → per-task specialist agents (from `agent-registry.ts`)

The per-task specialist agents (`styling`, `routing`, `component`, etc.) have clean, role-focused system prompts with no Marcus or Copilot references. However, the orchestration layer (`MarcusController`, `MarcusConversationEngine`, `MarcusTaskBus`, `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT`) still identifies itself as Marcus.

**Status: PARTIAL** — Specialist execution agents are clean. Orchestration layer leaks Marcus identity.

---

### C. Pure Conversation — Expected: Website Studio Assistant

**Actual:** `POST /api/copilot/agent` → `buildWebsiteStudioConversationPrompt()` → `WEBSITE_STUDIO_AI_IDENTITY`

Identity: `"You are an AI engineering agent inside Website Studio — a premium website building platform."`  
No Marcus. No Copilot. Correct tone and responsibilities.

**Status: PASS**

---

## Step 4 — Prompt Verification

### Prompt 1 — Website Studio Conversation Agent
**File:** `artifacts/api-server/src/ai/website-studio-ai.ts` L28–159  
**Used by:** `POST /api/copilot/agent`

```
You are an AI engineering agent inside Website Studio — a premium website building platform.

You work alongside the user inside their active project workspace. You can see their project
files, edit code, generate new pages, and answer questions about their project.

You write production-ready code, suggest improvements, and help bring ideas to life.
```

| Check | Result |
|---|---|
| Mentions Marcus? | **NO** |
| Mentions Copilot? | **NO** |
| Mentions Website Studio? | **YES** |
| Correct identity? | **YES** — "AI engineering agent inside Website Studio" |
| Correct responsibilities? | **YES** — see files, edit code, generate pages, answer questions |
| **Verdict** | **PASS** |

---

### Prompt 2 — Marcus Website Agent (Generation + Edit Orchestration)
**File:** `artifacts/api-server/src/lib/agents/marcus-website-agent.ts` L48  
**Used by:** Generation pipeline + Edit orchestration (via MarcusController)

```
You are Marcus, an autonomous AI software engineer inside Website Studio.
Your purpose is to transform a user's business idea into a production-quality web application.
...
```

| Check | Result |
|---|---|
| Mentions Marcus? | **YES — opening line** |
| Mentions Copilot? | NO |
| Mentions Website Studio? | YES |
| Correct identity? | **NO** — should be Website Studio Architect / Engineering Agent |
| Correct responsibilities? | YES (functionally) |
| **Verdict** | **FAIL** |

---

### Prompt 3 — Marcus Stream Agent (PLAN + EXECUTE phases)
**File:** `artifacts/api-server/src/lib/agents/marcus-stream-agent.ts` L187  
**Used by:** Generation pipeline code-writing phase

```
You are Marcus, an expert autonomous software engineer inside Website Studio.
Your job: transform a business idea into a complete, production-quality Next.js 14 App Router website.
...
```

| Check | Result |
|---|---|
| Mentions Marcus? | **YES — opening line** |
| Mentions Copilot? | NO |
| Mentions Website Studio? | YES |
| Correct identity? | **NO** |
| **Verdict** | **FAIL** |

---

### Prompt 4 — Marcus Fix/Repair Agent
**File:** `artifacts/api-server/src/lib/agents/marcus-stream-agent.ts` L266 (`buildFixSystemPrompt()`)  
**Used by:** Validation repair loop during generation

```
You are Marcus, an expert software engineer. The automated validator found these issues...
```

| Check | Result |
|---|---|
| Mentions Marcus? | **YES — opening line** |
| Mentions Website Studio? | **NO** |
| Correct identity? | **NO** |
| **Verdict** | **FAIL** |

---

### Prompt 5 — Specialist Agents (9 types)
**File:** `artifacts/api-server/src/lib/agent-registry.ts` L150–253  
**Used by:** Per-task execution in the edit pipeline

Prompts define role-specific instructions (Styling Specialist, Routing Specialist, Component Specialist, etc.) with no identity declaration.

| Check | Result |
|---|---|
| Mentions Marcus? | **NO** |
| Mentions Copilot? | **NO** |
| Correct responsibilities? | **YES** — strictly role-focused |
| **Verdict** | **PASS** |

---

### Prompt 6 — General Marcus Copilot
**File:** `artifacts/api-server/src/routes/copilot.ts` L207–226  
**Not reachable from Website Studio.**

Identity: `"Marcus. You are the STAGEONE Copilot — a co-founder, product strategist, and execution assistant."`  
Not audited further — this route is not called from Website Studio frontend.

---

## Step 5 — SSE Verification

### Conversation path (`POST /api/copilot/agent`)
Source: `artifacts/api-server/src/routes/copilot-agent.ts`

| Event | Real execution? | Originates from Copilot pipeline? |
|---|---|---|
| `thinking` | YES — reasoning delta from LLM | **NO** — Website Studio conversation route |
| `text` | YES — content delta from LLM | **NO** |
| `done` | YES — stream end | **NO** |
| `error` | YES — on failure | **NO** |

**Verdict: PASS** — All events originate from the clean Website Studio conversation handler.

---

### Edit path (`POST /api/website-v2/projects/:id/edit`)
Source: `artifacts/api-server/src/routes/edit-website-v2.ts` + `runEditingAgent()`

| Event | Real execution? | Originates from Copilot pipeline? |
|---|---|---|
| `analyzing`, `editing` | YES | NO — edit route only |
| `timeline` | YES — TimelineEngine checkpoints | NO |
| `confidence` | YES — ConfidenceEngine output | NO |
| `preview` | YES — static analysis result | NO |
| `visual` | YES — static analysis result | NO |
| `recovery` | YES — RecoveryEngine trigger | NO |
| `decision`, `audit`, `product`, `advisor`, `roadmap` | YES | NO |
| `changes`, `saved`, `regenerating`, `preview-ready` | YES | NO |

**Verdict: PASS** — All events originate from the Website Studio edit pipeline, not from the general copilot route. The Marcus backbone executes them but the SSE channel is isolated.

---

### Generation path (`POST /api/generate/website-v2`)
Source: `artifacts/api-server/src/routes/generate-website-v2.ts`

| Event | Real execution? | Originates from Copilot pipeline? |
|---|---|---|
| `start`, `project-created` | YES | NO |
| `thinking`, `architect` | YES | NO |
| `agent` (narration) | YES | NO |
| `done` | YES | NO |

**Verdict: PASS** — SSE is isolated. Identity in the prompts is wrong (Marcus), but the event channel is correct.

---

## Step 6 — UI Mode Verification

### How each mode is selected

`classifyIntent(text)` in `AgentConversation.tsx` L246–282 — regex on `text.toLowerCase().trim()`:

| Intent | Regex triggers |
|---|---|
| `"conversation"` | Greetings: `hi`, `hello`, `thanks`, `ok`, `yes`, `no`, `sure`, etc. |
| `"code-question"` | Question words + code artifacts: `what`, `how` + `file`, `component`, `code`, etc. |
| `"build-request"` | Creation verbs: `build`, `generate`, `scaffold`, `create new`, etc. |
| `"edit-request"` | Modification verbs: `add`, `change`, `fix`, `style`, `dark mode`, `responsive`, etc. |
| **Default** | `"conversation"` — anything not matched |

**Problem:** The default is `"conversation"` which routes to `POST /api/copilot/agent`. A message like `"make the hero bigger"` should be `"edit-request"` but could misclassify. A message like `"update the color scheme"` contains no listed trigger and becomes `"conversation"` — routing to a natural language response instead of the edit engine.

### Does the UI know which mode is active?

**Frontend:** No visible indicator. The user cannot see which classification was assigned. No badge, label, or mode toggle exists in `AgentConversation.tsx` or `StudioShell.tsx`.

**Backend:** Yes — different routes receive the request, so the backend always knows.

### Do prompts change per mode?

**YES:**
- Conversation → `WEBSITE_STUDIO_AI_IDENTITY` (correct)
- Edit → `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` (wrong identity)
- Generation → `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` + `MARCUS_SYSTEM_PROMPT` (wrong identity)

### Does the renderer change per mode?

**YES:**
- Conversation → streaming markdown text in chat thread only
- Edit → engineering panels (Timeline, Confidence, Recovery, Decision, Audit, Product, Advisor, Roadmap) + file tree + streaming narration
- Generation → architect output card + streaming narration + project scaffold

---

## Step 7 — Identity Leakage

### Backend Leaks

| Location | Line | Content | Severity |
|---|---|---|---|
| `artifacts/api-server/src/lib/agents/marcus-website-agent.ts` | 48 | `"You are Marcus, an autonomous AI software engineer inside Website Studio."` — opens MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT | **CRITICAL** — user-facing system prompt |
| `artifacts/api-server/src/lib/agents/marcus-stream-agent.ts` | 187 | `"You are Marcus, an expert autonomous software engineer inside Website Studio."` — MARCUS_SYSTEM_PROMPT | **CRITICAL** — user-facing system prompt |
| `artifacts/api-server/src/lib/agents/marcus-stream-agent.ts` | 266 | `"You are Marcus, an expert software engineer."` — buildFixSystemPrompt() | **CRITICAL** — repair agent identity |
| `artifacts/api-server/src/routes/edit-website-v2.ts` | 4–13 | Comments: "MarcusConversationEngine backbone", "same MarcusTaskBus / MarcusConversationEngine backbone" | LOW — documentation only |
| `artifacts/api-server/src/routes/edit-website-v2.ts` | 30–32 | `import { MarcusConversationEngine, MarcusTaskBus, MarcusController }` | MEDIUM — architectural dependency |
| `artifacts/api-server/src/routes/edit-website-v2.ts` | 81–82 | `new MarcusTaskBus(); new MarcusConversationEngine()` — instantiated per request | MEDIUM — runtime dependency |
| `artifacts/api-server/src/routes/edit-website-v2.ts` | 168 | `MarcusController.runEditFlow(...)` — sole pipeline entry | MEDIUM — architectural dependency |
| Class names throughout | — | `MarcusController`, `MarcusConversationEngine`, `MarcusTaskBus`, `MarcusStreamAgent` — all executed in Website Studio paths | LOW — internal naming |

### Frontend Leaks

| Location | Line | Content | Severity |
|---|---|---|---|
| `artifacts/stageone/src/components/website-v2/ide/AgentConversation.tsx` | 327 | `"Marcus applies every change as it happens, the same way Replit's agent does"` | **HIGH** — user-visible copy describing the editing agent |
| `artifacts/stageone/src/components/website-v2/ide/AgentConversation.tsx` | 645 | `"both are forwarded straight from Marcus's"` activity label comment | LOW — code comment |
| `artifacts/stageone/src/components/website-v2/ide/AgentConversation.tsx` | 402 | `"Website Studio's own generation activity bus — independent of Marcus"` — comment claiming independence while backed by Marcus | LOW — misleading comment |
| `artifacts/stageone/src/components/website-v2/ide/AgentConversation.tsx` | 16 | `"independent event bus, not Marcus"` — comment contradicted by backend | LOW — misleading comment |

### Identity Summary

| Identity String | Where It Appears | Reaches User? |
|---|---|---|
| `"You are Marcus, an autonomous AI software engineer inside Website Studio."` | MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT | Indirectly (shapes LLM output tone/self-reference) |
| `"You are Marcus, an expert autonomous software engineer inside Website Studio."` | MARCUS_SYSTEM_PROMPT (generation) | Indirectly |
| `"You are Marcus, an expert software engineer."` | buildFixSystemPrompt() (repair) | Indirectly |
| `"Marcus applies every change as it happens"` | AgentConversation.tsx L327 (UI copy) | **YES — directly rendered** |
| `"AI engineering agent inside Website Studio"` | WEBSITE_STUDIO_AI_IDENTITY | YES — conversation path only |

---

## Step 8 — Final Report

### PASS / FAIL Per Subsystem

| Subsystem | Status | Finding |
|---|---|---|
| Conversation route (`/api/copilot/agent`) | **PASS** | Clean implementation; uses WEBSITE_STUDIO_AI_IDENTITY; no Marcus |
| Edit route (`/api/website-v2/projects/:id/edit`) | **FAIL** | MarcusController owns pipeline; system prompt says "You are Marcus" |
| Generation route (`/api/generate/website-v2`) | **FAIL** | MarcusController owns pipeline; two system prompts say "You are Marcus" |
| General Marcus Copilot route (`/api/copilot`) | **PASS** | Not called from Website Studio — correctly isolated |
| Specialist agents (agent-registry.ts) | **PASS** | Clean role-focused prompts; no Marcus/Copilot references |
| Repair agent (buildFixSystemPrompt) | **FAIL** | "You are Marcus, an expert software engineer." |
| SSE event isolation | **PASS** | All events originate from Website Studio routes, not copilot pipeline |
| `WEBSITE_STUDIO_AI_IDENTITY` | **PASS** | Correct identity, tone, rules — ready to use |
| Frontend mode indicator | **FAIL** | No UI mode indicator exists |
| `classifyIntent()` default routing | **FAIL** | Default is "conversation" — unmatched edit phrases silently misroute |
| User-visible copy | **FAIL** | "Marcus applies every change" rendered in AgentConversation UI |

---

### Broken Wiring

1. **Edit pipeline identity** — `runEditingAgent()` uses `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` which opens with "You are Marcus". The clean `WEBSITE_STUDIO_AI_IDENTITY` exists but is not imported or used here.  
   **Files:** `marcus-website-agent.ts` L48, `website-v2-editor.ts` (orchestration)

2. **Generation pipeline identity** — Both `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` and `MARCUS_SYSTEM_PROMPT` in `marcus-stream-agent.ts` open with "You are Marcus".  
   **Files:** `marcus-website-agent.ts` L48, `marcus-stream-agent.ts` L187, L266

3. **`classifyIntent()` default** — Unrecognized input defaults to "conversation", routing to `/api/copilot/agent` instead of the edit engine. Ambiguous edit phrases silently become chat.  
   **File:** `AgentConversation.tsx` L282

---

### Dead Routing

- No dedicated `/api/website-studio/conversation` route — conversation is handled at `/api/copilot/agent` (functional but misleadingly named)
- No dedicated `/api/website-studio/architect` route — Architect is embedded inside `MarcusController.runWebsiteGeneration()`
- No dedicated `/api/website-studio/engineer` route — Edit pipeline has its own route but is owned by MarcusController

---

### Unused Routes (from Website Studio perspective)

- `POST /api/copilot` — General Marcus Copilot; never called from Website Studio frontend. Correctly unused.

---

### Duplicate Controllers

- **MarcusController** performs both website generation (`runWebsiteGeneration`) and website editing (`runEditFlow`). It is the sole orchestration controller for both paths. There is no parallel Website Studio–native controller.

---

### Identity Leakage (Summary)

| Leak | Location | User-Visible |
|---|---|---|
| "You are Marcus" | `marcus-website-agent.ts` L48 | Indirect (shapes model output) |
| "You are Marcus" | `marcus-stream-agent.ts` L187 | Indirect |
| "You are Marcus" | `marcus-stream-agent.ts` L266 | Indirect |
| "Marcus applies every change" | `AgentConversation.tsx` L327 | **YES** |

---

### Wrong Prompts

| Context | Expected Prompt | Actual Prompt |
|---|---|---|
| No website / generation | Website Studio Architect identity | `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` ("You are Marcus") |
| Existing website / edit orchestration | Website Studio Engineering Agent identity | `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` ("You are Marcus") |
| Validation repair | Website Studio Repair Agent identity | `buildFixSystemPrompt()` ("You are Marcus, an expert software engineer") |
| Conversation | Website Studio Assistant identity | `WEBSITE_STUDIO_AI_IDENTITY` ✓ |

---

### Wrong API Endpoints

- `POST /api/copilot/agent` is the correct endpoint for Website Studio conversation but its path contains "copilot" — this is a naming problem, not a behavior problem. The implementation is clean.

---

### Wrong Event Flow

None — SSE events are correctly isolated to their respective pipeline routes. No Website Studio event originates from the general Marcus Copilot route.

---

### Hidden Marcus Dependencies

| Dependency | Where | Notes |
|---|---|---|
| `MarcusController` | `edit-website-v2.ts` L30, L168; `generate-website-v2.ts` | Sole orchestrator for both edit and generation |
| `MarcusConversationEngine` | `edit-website-v2.ts` L30, L82 | Instantiated per edit request |
| `MarcusTaskBus` | `edit-website-v2.ts` L31, L81 | Instantiated per edit request |
| `MarcusStreamAgent` | `generate-website-v2.ts` (via marcus-stream-agent.ts) | Handles code generation phases |
| `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` | `marcus-website-agent.ts` → used by both edit and generation orchestration | System prompt with Marcus identity |

---

### Prioritized Fix Plan

| Priority | Fix | Files | Effort |
|---|---|---|---|
| **P0** | Replace `MARCUS_WEBSITE_AGENT_SYSTEM_PROMPT` opening line with Website Studio identity. Change `"You are Marcus, an autonomous AI software engineer inside Website Studio."` to use `WEBSITE_STUDIO_AI_IDENTITY` as the base. | `marcus-website-agent.ts` L48 | Small — string change |
| **P0** | Replace `MARCUS_SYSTEM_PROMPT` opening line in marcus-stream-agent.ts with Website Studio identity. | `marcus-stream-agent.ts` L187 | Small — string change |
| **P0** | Replace `buildFixSystemPrompt()` opening line with Website Studio identity. | `marcus-stream-agent.ts` L266 | Small — string change |
| **P0** | Remove "Marcus applies every change as it happens" from `AgentConversation.tsx` L327 — user-visible Marcus identity in the UI. Replace with neutral Website Studio copy. | `AgentConversation.tsx` L327 | Small — copy change |
| **P1** | Fix `classifyIntent()` default: change default from `"conversation"` to `"edit-request"` for inputs that are not clearly greetings or code-questions, OR expand keyword coverage for common edit phrases. | `AgentConversation.tsx` L282 | Small — logic change |
| **P1** | Add a visible mode indicator to the UI so the user knows whether their message will trigger conversation, edit, or generation. | `AgentConversation.tsx` or `StudioShell.tsx` | Medium — UI addition |
| **P2** | Rename route path: `POST /api/copilot/agent` → `POST /api/website-studio/conversation` (or similar) to eliminate the "copilot" naming in a Website Studio–only endpoint. Requires frontend URL update. | `copilot-agent.ts`, `WebsiteStudioRuntime.ts` L469 | Small — rename + 1 URL update |
| **P3** | Rename `MarcusController` → `WebsiteStudioController`, `MarcusConversationEngine` → `WebsiteStudioConversationEngine`, `MarcusTaskBus` → `WebsiteStudioTaskBus` to eliminate hidden brand dependency at the class level. | Multiple files | Large — architectural rename |

---

*No code was modified during this audit. Every finding references the exact file and line number where it was verified.*
