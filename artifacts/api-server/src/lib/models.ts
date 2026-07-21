// ─── STAGEONE Centralized Model Registry ──────────────────────────────────────
// All AI model assignments live here. Routes import from this file — never
// hardcode model strings in route files.
//
// Confirmed working models on this account (verified 2026-07-02):
//   nvidia/llama-3.3-nemotron-super-49b-v1       ✓
//   meta/llama-4-maverick-17b-128e-instruct       ✓
//   nvidia/nemotron-3-ultra-550b-a55b             ✓ (enable_thinking:true, reasoning_budget:16384)
//
// Website V2 production models (assigned 2026-07-11):
//   meta/llama-4-maverick-17b-128e-instruct       — Website V2 Architect + Blueprint agents
//   deepseek-ai/deepseek-v4-flash                 — Website V2 Code Generation agent (tried 2026-07-11: returns 0 files, does not support write_file tool format)
//
// Website V2 Code Generation model swap (2026-07-12):
//   Investigated replacing WEBSITE_V2_CODE_GEN (nemotron-3-super-120b-a12b, thinking
//   disabled) with a stronger model to address reported low creativity / code glitches.
//   Compared two candidates head-to-head via direct NIM calls with the real Marcus
//   system prompt:
//     - stepfun-ai/step-3.7-flash        — re-tested 2026-07-12, now returns 200 (the
//       401 note above is stale). It IS reachable on this account, but it's a "flash"
//       (small/fast) tier model — same speed class as the model we're replacing, so it
//       doesn't address the creativity complaint, and it produced fewer completed files
//       per token budget in side-by-side testing (4 vs 10 <write_file> blocks in a
//       6000-token sample).
//     - nvidia/nemotron-3-ultra-550b-a55b — already the account's proven frontier model
//       for COMPONENT_GENERATION and COPILOT (thinking enabled, 16K reasoning budget).
//       Same side-by-side test produced richer, more specific design reasoning and more
//       complete files per token budget. Chosen as the replacement.
//   WEBSITE_V2_CODE_GEN switched to nvidia/nemotron-3-ultra-550b-a55b. It automatically
//   inherits enable_thinking:true / reasoning_budget:16384 from MODEL_KWARGS below —
//   no explicit chatTemplateKwargs override exists in marcus-stream-agent.ts, so this
//   takes effect without further code changes. Streaming (SSE) has no server-side
//   request timeout, so the added reasoning overhead does not risk a hard cutoff.
//
// Dead models (timeout on this account):
//   qwen/qwen3.5-397b-a17b        ✗  — was BUSINESS_INTELLIGENCE, CHATBOT, AUTOMATION, ENHANCE
//   qwen/qwen3.5-122b-a10b        ✗  — was COMPONENT_GENERATION, COPILOT
//
// Assignment rationale:
//   BUSINESS_INTELLIGENCE    — Nemotron 49B: strong structured strategic reasoning
//   ORCHESTRATION            — Nemotron 49B: enterprise orchestration & coordination scoring
//   EXECUTION                — Nemotron 49B: multi-step workflow & execution planning
//   AGENT_PLANNING           — Nemotron 49B: memory-aware agent decomposition
//   MEMORY                   — Nemotron 49B: context compression & semantic linking
//   WEBSITE_PLANNING         — Llama-4 Maverick: fast streaming JSON section planning (non-V2 routes)
//   WEBSITE_V2_ARCHITECT     — Llama-4 Maverick: low-latency structured JSON for V2 Architect + Blueprint phases
//   WEBSITE_V2_CODE_GEN      — Nemotron Ultra 550B: frontier coding + creativity, thinking enabled (swapped 2026-07-12 from Nemotron Super 120B)
//   COMPONENT_GENERATION     — Nemotron Ultra 550B: frontier coding, thinking enabled (editor + legacy)
//   COPILOT                  — Nemotron Ultra 550B: frontier instruction-following, thinking + streaming enabled
//   COPILOT_FALLBACK_1       — Llama-4 Maverick: failover when primary is DEGRADED
//   COPILOT_FALLBACK_2       — Nemotron 49B: second failover
//   CHATBOT                  — Nemotron 49B: structured reasoning for chatbot design
//   AUTOMATION               — Nemotron 49B: multi-step workflow & automation planning
//   ENHANCE                  — Nemotron 49B: idea expansion & business framing
//   RECOMMENDATIONS          — Nemotron 49B: operational insight & system health analysis
//   SELF_OPTIMIZE            — Nemotron 49B: OS self-optimization loop

export const MODELS = {
  BUSINESS_INTELLIGENCE:  "nvidia/llama-3.3-nemotron-super-49b-v1",
  ORCHESTRATION:          "nvidia/llama-3.3-nemotron-super-49b-v1",
  EXECUTION:              "nvidia/llama-3.3-nemotron-super-49b-v1",
  AGENT_PLANNING:         "nvidia/llama-3.3-nemotron-super-49b-v1",
  MEMORY:                 "nvidia/llama-3.3-nemotron-super-49b-v1",
  WEBSITE_PLANNING:       "meta/llama-4-maverick-17b-128e-instruct",
  WEBSITE_V2_ARCHITECT:   "meta/llama-4-maverick-17b-128e-instruct",
  WEBSITE_V2_CODE_GEN:    "nvidia/nemotron-3-ultra-550b-a55b",
  COMPONENT_GENERATION:   "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT:                "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT_FALLBACK_1:     "meta/llama-4-maverick-17b-128e-instruct",
  COPILOT_FALLBACK_2:     "nvidia/llama-3.3-nemotron-super-49b-v1",
  CHATBOT:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  AUTOMATION:             "nvidia/llama-3.3-nemotron-super-49b-v1",
  ENHANCE:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  RECOMMENDATIONS:        "nvidia/llama-3.3-nemotron-super-49b-v1",
  SELF_OPTIMIZE:          "nvidia/llama-3.3-nemotron-super-49b-v1",
  NEMOTRON_3_SUPER_120B:  "nvidia/nemotron-3-super-120b-a12b",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Chat template kwargs for models that require them.
// nvidia/nemotron-3-ultra-550b-a55b: thinking enabled with a 16K token reasoning budget.
//   reasoning_content arrives in a separate SSE field (delta.reasoning_content) and is
//   handled by forwardStream (copilot) or silently discarded by streamNvidiaRequest/callModelJson.
// nvidia/nemotron-3-super-120b-a12b: enable_thinking: false prevents timeout on code gen.
export const MODEL_KWARGS: Partial<Record<ModelId, Record<string, unknown>>> = {
  "nvidia/nemotron-3-ultra-550b-a55b":       { enable_thinking: true,  reasoning_budget: 16384 },
  "nvidia/nemotron-3-super-120b-a12b":       { enable_thinking: false },
};
