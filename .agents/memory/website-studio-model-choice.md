---
name: website-studio-model-choice
description: Why WEBSITE_V2_CODE_GEN was swapped from Nemotron Super 120B to Nemotron Ultra 550B, and how to evaluate NVIDIA NIM model candidates for this account.
---

# Website Studio code-gen model choice

WEBSITE_V2_CODE_GEN (used by `runMarcusStreamAgent` in marcus-stream-agent.ts, the real
code-gen path for Website Studio) was switched from `nvidia/nemotron-3-super-120b-a12b`
(thinking disabled) to `nvidia/nemotron-3-ultra-550b-a55b` (thinking enabled, inherited
from MODEL_KWARGS) on 2026-07-12, to address reports of low creativity and code glitches.

**Why:** Side-by-side testing with the real Marcus system prompt showed the Ultra 550B
model produces more specific design reasoning and completes more files per token budget
than both the outgoing model and `stepfun-ai/step-3.7-flash` (the other candidate). A
real end-to-end generation through the live route produced 14 valid files with the
structural validator reporting zero errors and no format glitches.

**How to apply:** Never trust stale "model returns 401 / not accessible" comments in
`artifacts/api-server/src/lib/models.ts` at face value — NVIDIA NIM account access can
change over time. Re-test with a direct `fetch` to
`https://integrate.api.nvidia.com/v1/chat/completions` before ruling a model out again.
Streaming (SSE) routes here have no server-side request timeout, so enabling
`enable_thinking` on a bigger model is safe latency-wise as long as the client keeps the
SSE connection open.
