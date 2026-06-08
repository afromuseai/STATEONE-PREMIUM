---
name: V5 Business Graph Memory Foundation
description: 5 new DB tables + service layer that auto-updates whenever a generation completes; Memory API endpoints exposed
---

## What was built

**DB Tables (lib/db/src/schema/)**
- `business_graphs` — one record per project; JSONB columns: identity, audience, positioning, revenue, assets, operations, risks, goals
- `graph_nodes` — individual nodes (identity/audience/positioning/risk/asset/goal/metric); importance 1-10, source tracking
- `graph_relationships` — edges between nodes; strength 0.0-1.0, relationship type
- `business_events` — append-only event log; eventType enum, label, description, metadata JSONB
- `memory_snapshots` — full point-in-time graph snapshots; trigger field says what caused it

**Service (artifacts/api-server/src/lib/business-graph.ts)**
- `getBusinessGraph(projectId)` — fetch graph by projectId
- `upsertBusinessGraph(projectId, userId, fields)` — create or merge
- `createBusinessEvent(...)` — append one event
- `getBusinessTimeline(projectId, limit)` — ordered DESC by occurredAt
- `createMemorySnapshot(projectId, userId, trigger)` — snapshots full graph + nodes + relationships
- `onBusinessIntelligenceComplete(...)` — fire-and-forget pipeline; extracts identity/audience/positioning/risks/goals from BI JSON
- `onWebsiteGenerationComplete(...)` — fire-and-forget; extracts assets.websites, revenue.pricingModel
- `onChatbotGenerationComplete(...)` — stub ready
- `onAutomationGenerationComplete(...)` — stub ready

**Memory API (artifacts/api-server/src/routes/business-graph.ts)**
- GET `/api/business-graph/:projectId` — returns graph (auth + ownership check)
- GET `/api/business-graph/:projectId/timeline` — returns events ordered by time
- POST `/api/business-graph/:projectId/snapshot` — manual snapshot trigger

**Update pipelines wired into:**
- `generate.ts` → `onBusinessIntelligenceComplete` (fire-and-forget after done:true)
- `generate-website.ts` → `onWebsiteGenerationComplete` (fire-and-forget before res.end())
- Both routes now accept `projectId` in req.body
- Website panel now passes `projectId` to /api/generate/website

**Why:**
All pipelines are fire-and-forget with `.catch(() => {})` — they NEVER block or throw into the generation stream. Graph updates are best-effort by design.

**How to apply:**
Future modules (chatbot, automation) should call `onChatbotGenerationComplete` / `onAutomationGenerationComplete` from their generation routes exactly the same way — import from `../lib/business-graph`, fire-and-forget after the done signal.
