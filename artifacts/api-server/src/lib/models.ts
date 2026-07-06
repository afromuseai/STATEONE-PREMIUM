// ─── STAGEONE Centralized Model Registry ──────────────────────────────────────
// All AI model assignments live here. Routes import from this file — never
// hardcode model strings in route files.
//
// Confirmed working models on this account (verified 2026-07-02):
//   nvidia/llama-3.3-nemotron-super-49b-v1       ✓
//   meta/llama-4-maverick-17b-128e-instruct       ✓
//   nvidia/nemotron-3-ultra-550b-a55b             ✓ (requires enable_thinking:false in chat_template_kwargs)
//
// Dead models (timeout on this account):
//   qwen/qwen3.5-397b-a17b        ✗  — was BUSINESS_INTELLIGENCE, CHATBOT, AUTOMATION, ENHANCE
//   qwen/qwen3.5-122b-a10b        ✗  — was COMPONENT_GENERATION, COPILOT
//   deepseek-ai/deepseek-v4-flash ✗  — was COMPONENT_GENERATION
//
// Assignment rationale:
//   BUSINESS_INTELLIGENCE  — Nemotron 49B: strong structured strategic reasoning
//   ORCHESTRATION          — Nemotron 49B: enterprise orchestration & coordination scoring
//   EXECUTION              — Nemotron 49B: multi-step workflow & execution planning
//   AGENT_PLANNING         — Nemotron 49B: memory-aware agent decomposition
//   MEMORY                 — Nemotron 49B: context compression & semantic linking
//   WEBSITE_PLANNING       — Llama-4 Maverick: fast streaming JSON section planning
//   COMPONENT_GENERATION   — Nemotron Ultra 550B: frontier coding, thinking disabled
//   COPILOT                — Nemotron Ultra 550B: frontier instruction-following, thinking disabled
//   COPILOT_FALLBACK_1     — Llama-4 Maverick: failover when primary is DEGRADED
//   COPILOT_FALLBACK_2     — Nemotron 49B: second failover
//   CHATBOT                — Nemotron 49B: structured reasoning for chatbot design
//   AUTOMATION             — Nemotron 49B: multi-step workflow & automation planning
//   ENHANCE                — Nemotron 49B: idea expansion & business framing
//   RECOMMENDATIONS        — Nemotron 49B: operational insight & system health analysis
//   SELF_OPTIMIZE          — Nemotron 49B: OS self-optimization loop

export const MODELS = {
  BUSINESS_INTELLIGENCE: "nvidia/llama-3.3-nemotron-super-49b-v1",
  ORCHESTRATION:         "nvidia/llama-3.3-nemotron-super-49b-v1",
  EXECUTION:             "nvidia/llama-3.3-nemotron-super-49b-v1",
  AGENT_PLANNING:        "nvidia/llama-3.3-nemotron-super-49b-v1",
  MEMORY:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  WEBSITE_PLANNING:      "meta/llama-4-maverick-17b-128e-instruct",
  COMPONENT_GENERATION:  "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT:               "nvidia/nemotron-3-ultra-550b-a55b",
  COPILOT_FALLBACK_1:    "meta/llama-4-maverick-17b-128e-instruct",
  COPILOT_FALLBACK_2:    "nvidia/llama-3.3-nemotron-super-49b-v1",
  CHATBOT:               "nvidia/llama-3.3-nemotron-super-49b-v1",
  AUTOMATION:            "nvidia/llama-3.3-nemotron-super-49b-v1",
  ENHANCE:               "nvidia/llama-3.3-nemotron-super-49b-v1",
  RECOMMENDATIONS:       "nvidia/llama-3.3-nemotron-super-49b-v1",
  SELF_OPTIMIZE:         "nvidia/llama-3.3-nemotron-super-49b-v1",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Chat template kwargs for models that require them.
// nvidia/nemotron-3-ultra-550b-a55b has thinking mode ON by default — disabling it
// prevents silent long reasoning phases that cause apparent timeouts.
export const MODEL_KWARGS: Partial<Record<ModelId, Record<string, unknown>>> = {
  "nvidia/nemotron-3-ultra-550b-a55b": { enable_thinking: false },
};
