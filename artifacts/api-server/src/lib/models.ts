// ─── STAGEONE Centralized Model Registry ──────────────────────────────────────
// All AI model assignments live here. Routes import from this file — never
// hardcode model strings in route files.
//
// Confirmed working models on this account (verified 2026-07-02):
//   nvidia/llama-3.3-nemotron-super-49b-v1       ✓
//   meta/llama-4-maverick-17b-128e-instruct       ✓
//   nvidia/nemotron-3-ultra-550b-a55b             ✓ (enable_thinking:true, reasoning_budget:16384)
//
// Website V2 production models (assigned 2026-07-07):
//   meta/llama-4-maverick-17b-128e-instruct       — Website V2 Architect + Blueprint agents
//     (stepfun-ai/step-3.7-flash returns 401 Unauthorized on this account — not accessible)
//   nvidia/nemotron-3-super-120b-a12b             — Website V2 Code Generation agent (enable_thinking:false)
//
// Dead models (timeout on this account):
//   qwen/qwen3.5-397b-a17b        ✗  — was BUSINESS_INTELLIGENCE, CHATBOT, AUTOMATION, ENHANCE
//   qwen/qwen3.5-122b-a10b        ✗  — was COMPONENT_GENERATION, COPILOT
//   deepseek-ai/deepseek-v4-flash ✗  — was COMPONENT_GENERATION
//
// Assignment rationale:
//   BUSINESS_INTELLIGENCE    — Nemotron 49B: strong structured strategic reasoning
//   ORCHESTRATION            — Nemotron 49B: enterprise orchestration & coordination scoring
//   EXECUTION                — Nemotron 49B: multi-step workflow & execution planning
//   AGENT_PLANNING           — Nemotron 49B: memory-aware agent decomposition
//   MEMORY                   — Nemotron 49B: context compression & semantic linking
//   WEBSITE_PLANNING         — Llama-4 Maverick: fast streaming JSON section planning (non-V2 routes)
//   WEBSITE_V2_ARCHITECT     — Llama-4 Maverick: low-latency structured JSON for V2 Architect + Blueprint phases
//   WEBSITE_V2_CODE_GEN      — Nemotron Super 120B: large-context code generation, thinking disabled
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
  WEBSITE_V2_CODE_GEN:    "nvidia/nemotron-3-super-120b-a12b",
  COMPONENT_GENERATION:   "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT:                "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT_FALLBACK_1:     "meta/llama-4-maverick-17b-128e-instruct",
  COPILOT_FALLBACK_2:     "nvidia/llama-3.3-nemotron-super-49b-v1",
  CHATBOT:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  AUTOMATION:             "nvidia/llama-3.3-nemotron-super-49b-v1",
  ENHANCE:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  RECOMMENDATIONS:        "nvidia/llama-3.3-nemotron-super-49b-v1",
  SELF_OPTIMIZE:          "nvidia/llama-3.3-nemotron-super-49b-v1",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Chat template kwargs for models that require them.
// nvidia/nemotron-3-ultra-550b-a55b: thinking enabled with a 16K token reasoning budget.
//   reasoning_content arrives in a separate SSE field (delta.reasoning_content) and is
//   handled by forwardStream (copilot) or silently discarded by streamNvidiaRequest/callModelJson.
// nvidia/nemotron-3-super-120b-a12b: thinking explicitly disabled for code generation;
//   prevents an ~8-min reasoning timeout on large blueprint → code prompts.
export const MODEL_KWARGS: Partial<Record<ModelId, Record<string, unknown>>> = {
  "nvidia/nemotron-3-ultra-550b-a55b": { enable_thinking: true,  reasoning_budget: 16384 },
  "nvidia/nemotron-3-super-120b-a12b": { enable_thinking: false },
};
