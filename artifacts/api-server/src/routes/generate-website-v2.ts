// ─── Website Architect V2 — Route Shell ──────────────────────────────────────
// POST /api/generate/website-v2
//
// Commit 3: MarcusController now owns the pipeline (Architect Agent → blueprint
// guards → Design Review Agent → Code Generation Agent → infra file injection
// → persistence). This route is the thin request-lifecycle shell:
//
//   Open SSE stream
//     ↓
//   Build the Marcus runtime (task bus + conversation engine)
//     ↓
//   Validate input → assemble BusinessContext → create project record (DB)
//     ↓
//   MarcusController.runWebsiteGeneration(runtime) — owns every model call
//     ↓
//   Stream the SSE frames the controller forwards via onSse
//     ↓
//   Write the final `done` / `error` frame
//
// V1 is completely untouched. generate-website.ts is NOT imported or modified.
// website-html-generator.ts is NOT used here.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { logger } from "../lib/logger";
import { createV2Project } from "../lib/website-v2-projects";
import type { BusinessContext, V2SseEvent } from "../lib/website-v2-types";
import { MarcusConversationEngine } from "../lib/agents/marcus-conversation";
import type { ConversationEvent } from "../lib/agents/marcus-conversation";
import { MarcusTaskBus } from "../lib/agents/marcus-task-bus";
import { MarcusController, ARCHITECT_MODEL } from "../lib/agents/marcus-controller";
import { runMarcusStreamAgent } from "../lib/agents/marcus-stream-agent";

const router = Router();

// ─── Extract BusinessContext from request body ────────────────────────────────
// The idea is always required. All other fields are derived from BI output
// or fall back to sensible defaults inferred from the idea.
// ─── Extract BusinessContext from request body ────────────────────────────────
// The idea is always required. All other fields are derived from BI output
// or fall back to sensible defaults inferred from the idea.
function extractBusinessContext(body: Record<string, unknown>): BusinessContext {
  const idea = String(body.idea ?? "").trim();
  const bi = (body.businessIntelligence ?? {}) as Record<string, unknown>;
  const biContext = (body.biIntelligenceContext ?? {}) as Record<string, unknown>;

  // Extract BI Intelligence Context if provided
  const moduleContext = biContext.moduleContext as
    | {
        website?: { positioning?: string; conversionGoal?: string; recommendedPages?: string[]; primaryCTA?: string };
        chatbot?: { primaryRole?: string; requiredCapabilities?: string; qualificationQuestions?: string[]; escalationRules?: string };
        automation?: { highestValueWorkflow?: string; recommendedIntegrations?: string[]; businessProcess?: string };
        execution?: { recommendedAgents?: string[]; prioritySequence?: string[] };
      }
    | undefined;

  return {
    idea,
    companyName:      String(bi.companyName ?? bi.name ?? "The Company"),
    industry:         String(bi.industry   ?? "SaaS"),
    targetAudience:   String(bi.targetAudience ?? bi.audience ?? "professionals"),
    businessGoal:     String(bi.businessGoal   ?? bi.goal    ?? "grow the business"),
    brandPositioning: String(bi.brandPositioning ?? bi.positioning ?? "leading solution in the space"),
    conversionGoal:   String(bi.conversionGoal   ?? bi.conversion  ?? "sign up / get started"),
    existingBI:       Object.keys(bi).length > 0 ? bi : undefined,
    // BI Intelligence Context for downstream agents
    biIntelligenceContext: moduleContext ? {
      businessSnapshot: String(biContext.businessSnapshot ?? ""),
      targetMarket: String(biContext.targetMarket ?? ""),
      evidence: {
        facts: (biContext.evidence as any)?.facts ?? [],
        inferences: (biContext.evidence as any)?.inferences ?? [],
        hypotheses: (biContext.evidence as any)?.hypotheses ?? [],
        unknowns: (biContext.evidence as any)?.unknowns ?? [],
      },
      confidence: {
        overall: (biContext.confidence as any)?.overall ?? "LOW",
        reason: (biContext.confidence as any)?.reason ?? "Not provided",
      },
      decisionPriorities: (biContext.decisionPriorities as string[]) ?? [],
      moduleContext: moduleContext ? {
        website: {
          positioning: moduleContext.website?.positioning ?? "",
          conversionGoal: moduleContext.website?.conversionGoal ?? "",
          recommendedPages: moduleContext.website?.recommendedPages ?? [],
          primaryCTA: moduleContext.website?.primaryCTA ?? "",
        },
        chatbot: {
          primaryRole: moduleContext.chatbot?.primaryRole ?? "",
          requiredCapabilities: moduleContext.chatbot?.requiredCapabilities ?? "",
          qualificationQuestions: moduleContext.chatbot?.qualificationQuestions ?? [],
          escalationRules: moduleContext.chatbot?.escalationRules ?? "",
        },
        automation: {
          highestValueWorkflow: moduleContext.automation?.highestValueWorkflow ?? "",
          recommendedIntegrations: moduleContext.automation?.recommendedIntegrations ?? [],
          businessProcess: moduleContext.automation?.businessProcess ?? "",
        },
        execution: {
          recommendedAgents: moduleContext.execution?.recommendedAgents ?? [],
          prioritySequence: moduleContext.execution?.prioritySequence ?? [],
        },
      } : undefined,
    } : undefined,
  }
}

// ─── SSE helper ───────────────────────────────────────────────────────────────
function sseWrite(res: import("express").Response, event: V2SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Marcus Conversation helpers ──────────────────────────────────────────────
// Emit a single ConversationEvent over SSE and mirror it to the backend log.
function sseWriteAgent(res: import("express").Response, event: ConversationEvent): void {
  sseWrite(res, { phase: "agent", event });
  logger.info(
    {
      tag:       "[MARCUS]",
      type:      event.type,
      phase:     event.phase,
      ...(event.metadata?.path      !== undefined && { path:      event.metadata.path }),
      ...(event.metadata?.operation !== undefined && { operation: event.metadata.operation }),
      ...(event.metadata?.status    !== undefined && { status:    event.metadata.status }),
    },
    `[MARCUS] conversation event type=${event.type} phase=${event.phase ?? "global"}${event.metadata?.path ? ` path=${String(event.metadata.path)}` : ""}`,
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post(
  "/generate/website-v2",
  requireAuth,
  requireFeature("website_generator"),
  async (req, res): Promise<void> => {
    // Open SSE stream immediately so the client receives typed error events
    // rather than a plain HTTP error that the SSE reader treats as a network failure.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const userId = req.user?.userId ?? "";
    const pipelineStart = Date.now();

    // Marcus Conversation Engine — one instance per request.
    const engine = new MarcusConversationEngine();

    // ── Marcus Task Bus — one instance per request ─────────────────────────────
    // Single source of truth for every execution action during generation.
    // A subscriber translates bus events into SSE writes (preserving all
    // existing frame shapes). No globals. No singletons. Lifetime = this request only.
    const bus = new MarcusTaskBus();
    const unsubscribeBus = bus.subscribe((event) => {
      // llm:architect_start running (main only) → { phase: "start", model, industry }
      // Design-review architect_start is bus-internal; it must not re-emit the start frame.
      if (
        event.category === "llm" &&
        event.action   === "architect_start" &&
        event.status   === "running" &&
        event.phase    !== "design-review"
      ) {
        sseWrite(res, {
          phase:    "start",
          model:    String(event.metadata.model    ?? ARCHITECT_MODEL),
          industry: String(event.metadata.industry ?? ""),
        });
      }
      // database:save_project completed → { phase: "project-created", projectId }
      if (event.category === "database" && event.action === "save_project" && event.status === "completed") {
        const pid = event.metadata.projectId;
        if (pid) sseWrite(res, { phase: "project-created", projectId: String(pid) });
      }
      // database:save_files completed → { phase: "project-saved", projectId }
      if (event.category === "database" && event.action === "save_files" && event.status === "completed") {
        const pid = event.metadata.projectId;
        if (pid) sseWrite(res, { phase: "project-saved", projectId: String(pid) });
      }
    });

    // Wire the conversation engine as a second bus subscriber.
    const engineBusUnsub = engine.attachTaskBus(bus);

    bus.emit("pipeline", "start", "running", { userId }, "pipeline");

    try {
      const body = req.body as Record<string, unknown>;

      // ── Input validation ────────────────────────────────────────────────────
      if (!body.idea || typeof body.idea !== "string" || !String(body.idea).trim()) {
        bus.emit("pipeline", "error", "failed", { error: "NO_IDEA", userId }, "pipeline");
        sseWrite(res, {
          phase: "error",
          message: "No business idea provided. Please describe your business.",
          code: "NO_IDEA",
        });
        res.end();
        return;
      }

      // ── Assemble BusinessContext ────────────────────────────────────────────
      const context = extractBusinessContext(body);

      // ── Create project record ───────────────────────────────────────────────
      bus.emit("database", "save_project", "running", { userId, industry: context.industry, ideaLength: context.idea.length }, "pipeline");
      const projectId = await createV2Project(userId, context);
      bus.emit(
        "database", "save_project",
        projectId ? "completed" : "failed",
        { projectId: projectId ?? undefined, userId, industry: context.industry, ideaLength: context.idea.length },
        "pipeline",
      );
      // ↑ subscriber writes sseWrite({ phase: "project-created", projectId }) when completed

      // Flush UNDERSTAND phase start — events were generated by the pipeline:start bus emit above.
      for (const ev of engine.collect()) sseWriteAgent(res, ev);

      // ── MarcusController owns the rest of the pipeline ──────────────────────
      const result = await MarcusController.runWebsiteGeneration({
        taskBus:            bus,
        conversationEngine: engine,
        projectId,
        userId,
        businessContext:    context,
        pipelineStart,
        onSse:              (event) => sseWrite(res, event),
      });

      if (!result.ok) {
        sseWrite(res, { phase: "error", message: result.message, code: result.code });
        res.end();
        return;
      }

      sseWrite(res, { phase: "done", projectId: projectId ?? "", data: result.project });
      res.end();

    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");

      const message = isTimeout
        ? "The Architect Agent timed out — the AI service is busy. Please try again."
        : "An unexpected error occurred in the Website Architect. Please try again.";

      bus.emit("pipeline", "error", "failed", {
        error:     String(err),
        isTimeout,
        userId,
      }, "pipeline");

      // Only write SSE error if headers are already sent (stream was opened)
      if (res.headersSent) {
        sseWrite(res, { phase: "error", message, code: isTimeout ? "TIMEOUT" : "INTERNAL_ERROR" });
        res.end();
      } else {
        res.status(500).json({ error: message });
      }
    } finally {
      // Tear down the per-request bus: remove all subscribers and discard history.
      // Order: engine first (stops translations), then SSE subscriber, then clear.
      engineBusUnsub();
      unsubscribeBus();
      bus.clear();
    }
  }
);

// ─── POST /api/generate/website-v2/stream ─────────────────────────────────────
// Replit-style: single-pass streaming agent. Marcus thinks aloud, then writes
// files one by one using tool_call XML blocks. The frontend receives file tokens
// in real-time and streams them into Monaco editor. WebContainer boots when done.
//
// SSE event shapes: see StreamAgentSseEvent in marcus-stream-agent.ts
router.post(
  "/generate/website-v2/stream",
  requireAuth,
  requireFeature("website_generator"),
  async (req, res): Promise<void> => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const userId = req.user?.userId ?? "";
    const body   = req.body as Record<string, unknown>;

    if (!body.idea || typeof body.idea !== "string" || !String(body.idea).trim()) {
      res.write(`data: ${JSON.stringify({ phase: "error", message: "No business idea provided." })}\n\n`);
      res.end();
      return;
    }

    const context = extractBusinessContext(body);
    logger.info({ userId, industry: context.industry }, "[MARCUS_STREAM_ROUTE] Starting stream generation");

    // Same MarcusTaskBus backbone as the non-stream route — gives this pipeline
    // a single source of execution events too, for logging and future live
    // activity-feed consumers (see AgentActivity). SSE frame shapes emitted by
    // runMarcusStreamAgent are unchanged; the bus is purely additive here.
    const bus = new MarcusTaskBus();
    const unsubscribeBus = bus.subscribe((event) => {
      logger.info(
        { tag: "[MARCUS_STREAM_BUS]", category: event.category, action: event.action, status: event.status },
        `[MARCUS_STREAM_BUS] ${event.category}:${event.action} ${event.status}`,
      );
    });

    try {
      await runMarcusStreamAgent(context, userId, res, bus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected generation error";
      logger.error({ err, userId }, "[MARCUS_STREAM_ROUTE] Unhandled error");
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ phase: "error", message })}\n\n`);
      }
    } finally {
      unsubscribeBus();
      bus.clear();
      if (!res.writableEnded) res.end();
    }
  }
);

export default router;
