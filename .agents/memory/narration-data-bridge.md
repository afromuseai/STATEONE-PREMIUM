---
name: Narration data bridge (SSE -> UI)
description: How backend narration fields (summary/decision/reason/filesCreated/confidence) reach the frontend event bus without UI changes.
---

Backend SSE narration fields (see [Website generation backend narration](website-narration-backend.md)) were silently dropped by `event-registry.ts` before reaching `MarcusSessionState` — the bus/UI types already had slots for `decision`/`reason`/`files` but nothing populated them.

**Why:** `event-registry.ts` handlers only destructured the pre-existing known keys per event type; adding fields to the backend union alone doesn't make anything read them.

**How to apply:**
- The bridge is: `event-registry.ts` (parses raw SSE JSON → typed `MarcusSessionEvent`, added optional narration fields to `phase.changed`/`session.completed`) → `reducer.ts` (persists last-known value per field across phase transitions, doesn't clear on later phases) → `generation-adapter.ts` builds a `WebsiteGenerationSnapshot` → `generationBus`.
- Only the final `GENERATION_COMPLETED` bus event is a *reliable* carrier for all 5 fields at once — earlier coarse events (`PLANNING_STARTED`, `REVIEW_STARTED`) fire once per run via dedup (`emitOnce`) and may fire before a decision/confidence value has arrived from the backend, so those only forward the field if it happens to already be present.
- `GenerationEventDetails` (bus type) needed `summary`/`confidence` added — it already had `decision`/`reason`/`files`.
- The component that constructs the snapshot (`StudioShell.tsx`, calls `useWebsiteGenerationAdapter`) had to be updated too — it's not part of the marcus-session/generation-adapter module set but is unavoidable plumbing (a snapshot literal, not UI rendering) since nothing else builds `WebsiteGenerationSnapshot` from live session state.
