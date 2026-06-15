// ─── STAGEONE AI Model Monitor ─────────────────────────────────────────────────
// Fire-and-forget observability layer. Records every AI call without altering
// any generation logic or behavior. All calls are non-blocking.

import { db, aiModelRequestsTable } from "@workspace/db";
import { logger } from "./logger";

// ─── Provider map ─────────────────────────────────────────────────────────────
const MODEL_PROVIDER: Record<string, string> = {
  "qwen/qwen3.5-397b-a17b":                      "NVIDIA NIM / Qwen",
  "qwen/qwen3.5-122b-a10b":                       "NVIDIA NIM / Qwen",
  "nvidia/llama-3.3-nemotron-super-49b-v1":       "NVIDIA NIM / Nemotron",
  "meta/llama-4-maverick-17b-128e-instruct":      "NVIDIA NIM / Meta",
  "deepseek-ai/deepseek-v4-flash":                "NVIDIA NIM / DeepSeek",
  "stepfun-ai/step-3.7-flash":                    "NVIDIA NIM / StepFun",
  "black-forest-labs/flux-schnell":               "NVIDIA NIM / FLUX",
};

// ─── Cost per 1K tokens (USD) — estimated NVIDIA NIM pricing ──────────────────
// Input cost, Output cost
const MODEL_COST_PER_1K: Record<string, [number, number]> = {
  "qwen/qwen3.5-397b-a17b":                [0.00020, 0.00060],
  "qwen/qwen3.5-122b-a10b":                [0.00008, 0.00020],
  "nvidia/llama-3.3-nemotron-super-49b-v1":[0.00010, 0.00040],
  "meta/llama-4-maverick-17b-128e-instruct":[0.00005, 0.00015],
  "deepseek-ai/deepseek-v4-flash":          [0.00003, 0.00010],
  "stepfun-ai/step-3.7-flash":              [0.00004, 0.00012],
};

// ─── Model → feature inference (best-effort) ─────────────────────────────────
const MODEL_FEATURE: Record<string, string> = {
  "meta/llama-4-maverick-17b-128e-instruct": "Website Planning",
  "deepseek-ai/deepseek-v4-flash":           "Component Generation",
};

export function inferFeature(model: string, hint?: string): string {
  if (hint) return hint;
  return MODEL_FEATURE[model] ?? "AI Pipeline";
}

export function inferProvider(model: string): string {
  return MODEL_PROVIDER[model] ?? "NVIDIA NIM";
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inRate, outRate] = MODEL_COST_PER_1K[model] ?? [0.0001, 0.0003];
  return (inputTokens * inRate + outputTokens * outRate) / 1000;
}

// ─── Track a non-streaming call ───────────────────────────────────────────────
export interface TrackCallParams {
  model: string;
  feature?: string;
  userId?: string;
  projectId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  success: boolean;
  errorType?: string;
}

export function trackCall(params: TrackCallParams): void {
  Promise.resolve().then(async () => {
    try {
      const inp  = params.inputTokens  ?? 0;
      const out  = params.outputTokens ?? 0;
      const tot  = params.totalTokens  ?? (inp + out);
      const cost = estimateCost(params.model, inp, out);

      await db.insert(aiModelRequestsTable).values({
        userId:        params.userId    ?? null,
        projectId:     params.projectId ?? null,
        model:         params.model,
        provider:      inferProvider(params.model),
        feature:       inferFeature(params.model, params.feature),
        inputTokens:   inp,
        outputTokens:  out,
        totalTokens:   tot,
        latencyMs:     params.latencyMs,
        success:       params.success,
        errorType:     params.errorType ?? null,
        estimatedCost: cost.toFixed(6),
      });
    } catch (err) {
      // Never let monitoring errors surface to callers
      logger.warn({ err }, "[model-monitor] Failed to record AI request");
    }
  });
}

// ─── Track a streaming call (tokens estimated from buffer length) ─────────────
export interface TrackStreamParams {
  model: string;
  feature?: string;
  userId?: string;
  projectId?: string;
  bufferLength: number;   // chars in accumulated output
  latencyMs: number;
  success: boolean;
  errorType?: string;
}

export function trackStream(params: TrackStreamParams): void {
  // Rough estimation: ~4 chars per output token for English text
  const outputTokens = Math.round(params.bufferLength / 4);
  // Streaming doesn't return input token count; estimate from a typical prompt
  const inputTokens  = 800;

  trackCall({
    model:        params.model,
    feature:      params.feature,
    userId:       params.userId,
    projectId:    params.projectId,
    inputTokens,
    outputTokens,
    totalTokens:  inputTokens + outputTokens,
    latencyMs:    params.latencyMs,
    success:      params.success,
    errorType:    params.errorType,
  });
}
