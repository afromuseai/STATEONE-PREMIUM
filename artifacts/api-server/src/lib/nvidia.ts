// ─── STAGEONE Centralized NVIDIA NIM Client ───────────────────────────────────
// All AI calls flow through this module for unified logging, error handling,
// and observability. NO silent fallbacks — failures throw explicit errors.

import { jsonrepair } from "jsonrepair";
import { logger } from "./logger";
import { MODEL_KWARGS, type ModelId } from "./models";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaCallOptions {
  model: ModelId | string;
  messages: NvidiaMessage[];
  temperature?: number;
  maxTokens?: number;
  chatTemplateKwargs?: Record<string, unknown>;
  signal?: AbortSignal;
}

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error("[AI] NVIDIA_API_KEY is not configured — set it in Replit Secrets");
  }
  return key;
}

function buildBody(options: NvidiaCallOptions, stream: boolean): Record<string, unknown> {
  const { model, messages, temperature = 0.7, maxTokens = 4000, chatTemplateKwargs } = options;

  const kwargs = chatTemplateKwargs ?? MODEL_KWARGS[model as ModelId];

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  if (kwargs) {
    body.chat_template_kwargs = kwargs;
  }

  return body;
}

// ─── Non-streaming call ────────────────────────────────────────────────────────
export async function callNvidia(options: NvidiaCallOptions): Promise<string> {
  const apiKey = getApiKey();
  const { model } = options;
  const start = Date.now();

  logger.info(
    { layer: "nvidia", model, stage: "request", messageCount: options.messages.length },
    `[AI:${model}] Calling (non-stream)`
  );

  const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildBody(options, false)),
  });

  const ms = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { layer: "nvidia", model, status: response.status, ms, errorText: errorText.slice(0, 400) },
      `[AI:${model}] FAILED (${response.status}) after ${ms}ms`
    );
    throw new Error(
      `[AI:${model}] Request failed — HTTP ${response.status}: ${errorText.slice(0, 200)}`
    );
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const usage = json.usage;
  logger.info(
    {
      layer: "nvidia",
      model,
      stage: "response",
      ms,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    },
    `[AI:${model}] Complete in ${ms}ms (${usage?.total_tokens ?? "?"} tokens)`
  );

  return json.choices?.[0]?.message?.content ?? "";
}

// ─── Streaming call — returns response body for SSE forwarding ─────────────────
export async function streamNvidia(
  options: NvidiaCallOptions
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();
  const { model, signal } = options;

  logger.info(
    { layer: "nvidia", model, stage: "stream_start", messageCount: options.messages.length },
    `[AI:${model}] Starting stream`
  );

  const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildBody(options, true)),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { layer: "nvidia", model, status: response.status, errorText: errorText.slice(0, 400) },
      `[AI:${model}] Stream FAILED (${response.status})`
    );
    throw new Error(
      `[AI:${model}] Stream failed — HTTP ${response.status}: ${errorText.slice(0, 200)}`
    );
  }

  if (!response.body) {
    logger.error({ layer: "nvidia", model }, `[AI:${model}] No response body returned`);
    throw new Error(`[AI:${model}] No response body — model returned empty stream`);
  }

  logger.info(
    { layer: "nvidia", model, stage: "stream_open" },
    `[AI:${model}] Stream open`
  );

  return response.body;
}

// ─── SSE forwarding helper ─────────────────────────────────────────────────────
// Reads an NVIDIA SSE stream, forwards content chunks to the Express response,
// and returns the fully accumulated content buffer.
export async function forwardStream(
  body: ReadableStream<Uint8Array>,
  res: import("express").Response,
  model: string
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let carry = "";
  let buffer = "";
  let tokenCount = 0;
  const start = Date.now();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = carry + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            buffer += content;
            tokenCount++;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {
          // Incomplete SSE fragment — skip
        }
      }
    }

    // Flush any remaining carry
    if (carry.startsWith("data: ")) {
      const data = carry.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) buffer += content;
        } catch { /* ignore */ }
      }
    }
  } finally {
    const ms = Date.now() - start;
    logger.info(
      { layer: "nvidia", model, stage: "stream_done", ms, chunks: tokenCount },
      `[AI:${model}] Stream complete in ${ms}ms (${tokenCount} chunks)`
    );
  }

  return buffer;
}

// ─── JSON extraction helper ────────────────────────────────────────────────────
export function extractJson(raw: string): unknown {
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();
  const objStart = clean.indexOf("{");
  const objEnd = clean.lastIndexOf("}");
  const arrStart = clean.indexOf("[");
  const arrEnd = clean.lastIndexOf("]");
  // Prefer whichever delimiter appears first (array or object)
  if (arrStart !== -1 && arrEnd !== -1 && (objStart === -1 || arrStart < objStart)) {
    clean = clean.slice(arrStart, arrEnd + 1);
  } else if (objStart !== -1 && objEnd !== -1) {
    clean = clean.slice(objStart, objEnd + 1);
  }
  // Try strict parse first; fall back to jsonrepair for model output quirks
  // (missing commas, trailing commas, unquoted keys, etc.)
  try {
    return JSON.parse(clean);
  } catch {
    return JSON.parse(jsonrepair(clean));
  }
}
