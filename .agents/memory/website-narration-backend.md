---
name: Website generation backend narration
description: How marcus-stream-agent's SSE events carry rich narration (decisions, file purpose, completion summary) without new LLM calls or fabricated facts.
---

`marcus-stream-agent.ts` emits optional narration fields (`summary`, `decision`, `reason`, `filesCreated`, `confidence`, per-event `message`) on top of its existing SSE event shapes. All logic lives in `marcus-narration.ts` as pure functions.

**Why:** the spec required richer narration per generation phase (understanding, planning/design, per-file purpose, quality check, completion) with a hard "never invent a fact" rule and no new model calls.

**How to apply:**
- Design decisions are extracted from the model's own free-text PLAN section (the text before `---BEGIN FILES---`) via keyword/sentence heuristics in `extractDesignDecision` — if the model didn't state one, no design event is emitted (never faked).
- Per-file purpose narration (`buildFilePurpose`) uses a filename-convention lookup (Hero.tsx → hero section, etc.), not real content inspection — falls back to a generic "Writing {path}." for unknown names, still no invented facts.
- Confidence (`HIGH`/`MEDIUM`/`LOW`) is derived purely from validation outcome + fix-iteration count, never guessed.
- All new fields are optional/additive on the existing discriminated union — frontend (`event-registry.ts`, `generation-adapter.ts` in `artifacts/stageone`) currently only reads known fields and silently ignores the new ones, so this stayed fully backend-only (no frontend files touched) while remaining backward compatible.
