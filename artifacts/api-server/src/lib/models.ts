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
//   WEBSITE_PLANNING       — Llama 4 Maverick 17B-128E: structured JSON section planning (streaming)
//   COMPONENT_GENERATION   — Llama 4 Maverick 17B-128E: React/Tailwind component code generation
//   COPILOT                — Qwen 3.5 397B: cross-system coordination assistant
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
  COMPONENT_GENERATION:  "meta/llama-4-maverick-17b-128e-instruct",
  COPILOT:               "nvidia/llama-3.3-nemotron-super-49b-v1",
  COPILOT_FALLBACK:      "meta/llama-4-maverick-17b-128e-instruct",
  CHATBOT:               "qwen/qwen3.5-397b-a17b",
  AUTOMATION:            "qwen/qwen3.5-397b-a17b",
  ENHANCE:               "qwen/qwen3.5-397b-a17b",
  RECOMMENDATIONS:       "nvidia/llama-3.3-nemotron-super-49b-v1",
  SELF_OPTIMIZE:         "nvidia/llama-3.3-nemotron-super-49b-v1",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Chat template kwargs for models that require them (none currently needed)
export const MODEL_KWARGS: Partial<Record<ModelId, Record<string, unknown>>> = {};
