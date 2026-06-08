// ─── STAGEONE Centralized Model Registry ──────────────────────────────────────
// All AI model assignments live here. Routes import from this file — never
// hardcode model strings in route files.
//
// Assignment rationale:
//   BUSINESS_INTELLIGENCE  — Qwen 3.5 397B: strongest structured strategic reasoning
//   ORCHESTRATION          — Nemotron 49B: enterprise orchestration & coordination scoring
//   EXECUTION              — Nemotron 49B: multi-step workflow & execution planning
//   AGENT_PLANNING         — Nemotron 49B: memory-aware agent decomposition
//   MEMORY                 — Nemotron 49B: context compression & semantic linking
//   WEBSITE_PLANNING       — Llama-4 Maverick: fast streaming JSON section planning
//   COMPONENT_GENERATION   — DeepSeek V4 Flash: fast 284B MoE coding model
//   COPILOT                — Nemotron 49B v1.5: low-latency instruction-following, workspace command emission
//   CHATBOT                — Qwen 3.5 397B: structured reasoning for chatbot design
//   AUTOMATION             — Qwen 3.5 397B: multi-step workflow & automation planning
//   ENHANCE                — Qwen 3.5 397B: idea expansion & business framing
//   RECOMMENDATIONS        — Nemotron 49B: operational insight & system health analysis
//   SELF_OPTIMIZE          — Nemotron 49B: OS self-optimization loop

export const MODELS = {
  BUSINESS_INTELLIGENCE: "qwen/qwen3.5-397b-a17b",
  ORCHESTRATION:         "nvidia/llama-3.3-nemotron-super-49b-v1",
  EXECUTION:             "nvidia/llama-3.3-nemotron-super-49b-v1",
  AGENT_PLANNING:        "nvidia/llama-3.3-nemotron-super-49b-v1",
  MEMORY:                "nvidia/llama-3.3-nemotron-super-49b-v1",
  WEBSITE_PLANNING:      "meta/llama-4-maverick-17b-128e-instruct",
  COMPONENT_GENERATION:  "deepseek-ai/deepseek-v4-flash",
  COPILOT:               "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  CHATBOT:               "qwen/qwen3.5-397b-a17b",
  AUTOMATION:            "qwen/qwen3.5-397b-a17b",
  ENHANCE:               "qwen/qwen3.5-397b-a17b",
  RECOMMENDATIONS:       "nvidia/llama-3.3-nemotron-super-49b-v1",
  SELF_OPTIMIZE:         "nvidia/llama-3.3-nemotron-super-49b-v1",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Chat template kwargs for models that require them.
export const MODEL_KWARGS: Partial<Record<ModelId, Record<string, unknown>>> = {};
