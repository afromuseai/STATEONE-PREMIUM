// ─── STAGEONE Centralized NVIDIA NIM Client ───────────────────────────────────
// All AI calls flow through this module for unified logging, error handling,
// and observability. NO silent fallbacks — failures throw explicit errors.

import { jsonrepair } from "jsonrepair";
import { logger } from "./logger";
import { MODEL_KWARGS, type ModelId } from "./models";
import { trackCall, trackStream } from "./model-monitor";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_CHAT_URL = `${NVIDIA_BASE}/chat/completions`;

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaCallOptions {
  model: ModelId | string;
  messages: NvidiaMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  chatTemplateKwargs?: Record<string, unknown>;
  // nvext controls model-level features — e.g. { thinking: { enabled: false } } to disable
  // extended thinking on Nemotron 49B so all tokens go directly to output content.
  nvextParams?: Record<string, unknown>;
  signal?: AbortSignal;
  // ── Observability metadata (optional, does not affect generation) ──────────
  _feature?: string;
  _userId?: string;
  _projectId?: string;
}

// ─── Detect NVIDIA degraded deployment errors ──────────────────────────────────
// Matches infrastructure-level failures where the model function itself is down.
// Used by callers to distinguish degradation from generic network/HTTP errors.
const DEGRADED_PATTERNS = [
  /degraded function cannot be invoked/i,
  /function unavailable/i,
  /deployment unavailable/i,
  /model temporarily unavailable/i,
];

export function isModelDegradedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return DEGRADED_PATTERNS.some((p) => p.test(msg));
}

// ─── Parse NVIDIA error body — extracts function_id if present ────────────────
function parseNvidiaError(text: string): { detail?: string; functionId?: string; raw: string } {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const detail =
      typeof json["detail"] === "string" ? json["detail"] : undefined;
    const functionId =
      typeof json["function_id"] === "string" ? json["function_id"] :
      typeof json["functionId"]  === "string" ? json["functionId"]  :
      undefined;
    return { detail, functionId, raw: text };
  } catch {
    return { raw: text };
  }
}

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error("[AI] NVIDIA_API_KEY is not configured — set it in Replit Secrets");
  }
  return key;
}

function buildBody(options: NvidiaCallOptions, stream: boolean): Record<string, unknown> {
  const { model, messages, temperature = 0.7, topP, maxTokens = 4000, chatTemplateKwargs, nvextParams } = options;

  const kwargs = chatTemplateKwargs ?? MODEL_KWARGS[model as ModelId];

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  if (topP !== undefined) {
    body.top_p = topP;
  }

  if (kwargs) {
    body.chat_template_kwargs = kwargs;
  }

  if (nvextParams) {
    body.nvext = nvextParams;
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

  let response: Response;
  try {
    response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildBody(options, false)),
    });
  } catch (err) {
    const ms = Date.now() - start;
    logger.error(
      { layer: "nvidia", MODEL_NAME: model, REQUEST_URL: NVIDIA_CHAT_URL, ms, networkError: String(err) },
      `[AI:${model}] Network error (non-stream)`
    );
    trackCall({ model, feature: options._feature, userId: options._userId, projectId: options._projectId, latencyMs: ms, success: false, errorType: "network_error" });
    throw err;
  }

  const ms = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    const parsed = parseNvidiaError(errorText);
    logger.error(
      {
        layer: "nvidia",
        MODEL_NAME:           model,
        REQUEST_URL:          NVIDIA_CHAT_URL,
        FUNCTION_ID:          parsed.functionId ?? "(not in response)",
        NVIDIA_RESPONSE_BODY: parsed.raw,
        status:               response.status,
        ms,
      },
      `[AI:${model}] FAILED (${response.status}) after ${ms}ms — ${parsed.detail ?? parsed.raw.slice(0, 120)}`
    );
    trackCall({ model, feature: options._feature, userId: options._userId, projectId: options._projectId, latencyMs: ms, success: false, errorType: `http_${response.status}` });
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

  // ── Fire-and-forget observability record (does not affect return value) ────
  trackCall({
    model,
    feature:      options._feature,
    userId:       options._userId,
    projectId:    options._projectId,
    inputTokens:  usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    totalTokens:  usage?.total_tokens,
    latencyMs:    ms,
    success:      true,
  });

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

  const response = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildBody(options, true)),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const parsed = parseNvidiaError(errorText);
    logger.error(
      {
        layer: "nvidia",
        MODEL_NAME:           model,
        REQUEST_URL:          NVIDIA_CHAT_URL,
        FUNCTION_ID:          parsed.functionId ?? "(not in response)",
        NVIDIA_RESPONSE_BODY: parsed.raw,
        status:               response.status,
      },
      `[AI:${model}] Stream FAILED (${response.status}) — ${parsed.detail ?? parsed.raw.slice(0, 120)}`
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
  model: string,
  _meta?: { feature?: string; userId?: string; projectId?: string }
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let carry = "";
  let buffer = "";
  let tokenCount = 0;
  const start = Date.now();
  let thinkingSignalSent = false;
  let thinkingEndSignalSent = false;
  let streamFailed = false;
  let streamError: string | undefined;

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
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content;
          const reasoning = delta?.reasoning_content;
          // [TRACE] Log first raw chunk so we can see exactly what the model returns
          if (tokenCount === 0 && !buffer) {
            logger.info(
              { layer: "nvidia_trace", model, hasContent: !!content, hasReasoning: !!reasoning, contentSnippet: String(content ?? "").slice(0, 80), reasoningSnippet: String(reasoning ?? "").slice(0, 80), rawData: data.slice(0, 200) },
              `[AI:${model}] [TRACE] First chunk`
            );
          }
          if (reasoning && !thinkingSignalSent) {
            // Model has entered its reasoning/thinking phase — notify client immediately
            thinkingSignalSent = true;
            res.write(`data: ${JSON.stringify({ thinking: true })}\n\n`);
            logger.info(
              { layer: "nvidia_trace", model, reasoningSnippet: String(reasoning).slice(0, 120) },
              `[AI:${model}] Thinking phase started`
            );
          }
          if (content) {
            if (thinkingSignalSent && !thinkingEndSignalSent) {
              // First content token after reasoning — close the thinking phase
              thinkingEndSignalSent = true;
              res.write(`data: ${JSON.stringify({ thinking: false })}\n\n`);
              logger.info(
                { layer: "nvidia_trace", model },
                `[AI:${model}] Thinking phase ended — content streaming`
              );
            }
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
  } catch (err) {
    streamFailed = true;
    streamError = err instanceof Error ? err.constructor.name : "stream_error";
  } finally {
    const ms = Date.now() - start;
    logger.info(
      { layer: "nvidia", model, stage: "stream_done", ms, chunks: tokenCount },
      `[AI:${model}] Stream complete in ${ms}ms (${tokenCount} chunks)`
    );

    // ── Fire-and-forget observability record ─────────────────────────────────
    trackStream({
      model,
      feature:      _meta?.feature,
      userId:       _meta?.userId,
      projectId:    _meta?.projectId,
      bufferLength: buffer.length,
      latencyMs:    ms,
      success:      !streamFailed,
      errorType:    streamError,
    });
  }

  return buffer;
}

// ─── JSON extraction helper ────────────────────────────────────────────────────
export function extractJson(raw: string): unknown {
  let clean = raw.trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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
