---
name: Marcus Graph Memory Integration
description: How the copilot/Marcus route loads project business graph memory before generating responses, and the Truthfulness Layer that maps evidence types.
---

# Marcus Business Graph Memory Integration

## What was built
Four helper functions added to `artifacts/api-server/src/lib/business-graph.ts`:
- `getRelevantGraphNodes(graphId, limit)` — top nodes by importance
- `getRecentBusinessEvents(projectId, limit)` — wraps getBusinessTimeline
- `getBusinessContext(projectId)` — loads graph + nodes + events + latest snapshot in parallel
- `getBusinessMemorySummary(ctx)` — formats the BusinessContextResult into a structured prompt string

## How it's wired into copilot.ts
- Import: `getBusinessContext`, `getBusinessMemorySummary`, `BusinessContextResult` from `../lib/business-graph`
- Added as 6th item in the Promise.all — runs in parallel with existing queries, no latency cost
- `businessGraphBlock` is built after the existing blocks; empty string if no graph exists yet
- Injected into system prompt between `${historyBlock}` and `${businessBlock}`:
  `${workspaceBlock}${historyBlock}${businessGraphBlock}${businessBlock}${memoryBlock}`

## Prompt block structure (=== BUSINESS GRAPH MEMORY ===)
Sections within the block (all optional, only appear if data exists):
- [IDENTITY] — name, industry, stage, summary, metrics (labeled INFERENCE)
- [AUDIENCE] — target, customer problems
- [POSITIONING] — differentiation, value prop
- [REVENUE MODEL] — monetization strategy, pricing
- [ASSETS (FACT)] — websites/chatbots/automations actually generated
- [OPERATIONS] — lead gen, onboarding approach
- [RISKS (INFERENCE)] — AI-derived from BI output
- [GOALS] — short/long-term from BI
- [KEY GRAPH NODES] — top 8 by importance
- [RECENT TIMELINE (FACT)] — last 10 business events
- [LAST MEMORY SNAPSHOT] — trigger + date of most recent snapshot

## Truthfulness Layer (injected with the block)
Maps 4 evidence types to their graph sources:
- FACT → [ASSETS (FACT)], [RECENT TIMELINE (FACT)], [LAST MEMORY SNAPSHOT], WORKSPACE REALITY
- MEMORY → [IDENTITY], [AUDIENCE], [POSITIONING], [REVENUE MODEL], [GOALS], [KEY GRAPH NODES], WORKSPACE MEMORY
- INFERENCE → [OPERATIONS], [RISKS (INFERENCE)], [Metrics (INFERENCE)]
- HYPOTHESIS → no graph entry exists; must signal "I don't know yet"

**Why:** Marcus was prompt-aware only, not project-aware. Without graph memory, it would claim ignorance about context already generated (assets, audience, risks) or require users to re-explain what they built.

**How to apply:** If Marcus behavior for graph queries changes, check the block injection order and the Truthfulness Layer instructions inside `businessGraphBlock` in copilot.ts. The block only appears when `activeProjectId` is present and the graph exists.
