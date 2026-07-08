// ─── Marcus Agent Controller ───────────────────────────────────────────────────
//
// Phase 2 Commit 1 — Backend orchestration skeleton.
//
// Owns the full UNDERSTAND → PLAN → DESIGN → BUILD → TEST → IMPROVE → REPORT
// lifecycle for an autonomous Marcus website generation task.
//
// What this file IS:
//   • The agent brain: sequential phase execution with shared context threading
//   • The observability layer: [MARCUS] structured logging per phase
//   • The error surface: per-phase result envelope with success/failure/errors
//   • Ready to call the existing model infrastructure (callNvidia) per phase
//
// What this file IS NOT:
//   • It does not touch the Website Studio frontend
//   • It does not modify generate-website-v2.ts
//   • It does not replace or redesign the SSE system
//   • It does not emit fake or mock AI responses
//
// Connection point: when a caller is ready to wire Marcus into generation,
// import `MarcusController` and call `run(taskContext)`.

import { callNvidia }              from "../nvidia";
import { logger }                  from "../logger";
import { MODELS }                  from "../models";
import {
  buildMarcusSystemPrompt,
  buildMarcusUserPrompt,
  MARCUS_AGENT_PHASES,
  type MarcusAgentPhase,
  type MarcusTaskContext as AgentMarcusTaskContext,
} from "./marcus-website-agent";
import {
  createAgentEvent,
  agentThought,
  agentAction,
  agentSuccess,
  agentError,
  type AgentEvent,
} from "./types";

// ─── Business context sub-object ─────────────────────────────────────────────
//
// Encapsulates all business-level fields as a named group.
// Passed as `ctx.businessContext` on MarcusTaskContext and expanded into the
// flat agent-level prompt by toAgentContext().

export interface MarcusBusinessContext {
  companyName?:      string;
  industry?:         string;
  targetAudience?:   string;
  businessGoal?:     string;
  brandPositioning?: string;
  conversionGoal?:   string;
}

// ─── Controller-scoped task context ──────────────────────────────────────────
//
// The primary input type for MarcusController.run().
// Identity fields (userId, projectId) are controller-only — the agent prompt
// builder receives only the AgentMarcusTaskContext slice, keeping prompt
// construction independent of auth and routing concerns.

export interface MarcusTaskContext {
  // ── Identity ────────────────────────────────────────────────────────────────
  /** Authenticated user who initiated this task. */
  userId:    string;
  /** Website Studio project being generated or modified. */
  projectId: string;

  // ── Core brief ──────────────────────────────────────────────────────────────
  /** The raw business idea or change request from the user. */
  idea: string;

  // ── Business context ────────────────────────────────────────────────────────
  /** Structured business-level metadata used to shape every agent phase. */
  businessContext?: MarcusBusinessContext;

  // ── Aesthetic preferences ───────────────────────────────────────────────────
  style?: string;
  tone?:  string;
}

// ─── Per-phase result ─────────────────────────────────────────────────────────
//
// Each phase returns one of these. The controller accumulates them in order.
// Callers that need structured parsing (e.g. PLAN JSON, BUILD files) inspect
// the `output` field — format is phase-specific (see MARCUS_PHASE_EXTENSIONS).

export interface MarcusPhaseResult {
  /** Which lifecycle phase produced this result. */
  phase:      MarcusAgentPhase;
  /** Whether the phase completed without an unrecoverable error. */
  success:    boolean;
  /**
   * Raw string output from the model for this phase.
   * For UNDERSTAND/PLAN/TEST/IMPROVE: JSON string per the phase extension schema.
   * For DESIGN: WebsiteBlueprint JSON string.
   * For BUILD:  GeneratedProject JSON string.
   * For REPORT: Plain prose following Marcus Contract 4.
   * Null when the phase failed before any model output was produced.
   */
  output:     string | null;
  /** Wall-clock duration of this phase in milliseconds. */
  durationMs: number;
  /** Human-readable error messages — empty array on success. */
  errors:     string[];
  /** Agent events emitted during this phase — for future SSE forwarding. */
  events:     AgentEvent[];
}

// ─── Full controller result ───────────────────────────────────────────────────

export interface MarcusControllerResult {
  /** Opaque task identifier for log correlation. */
  taskId:      string;
  /** True only when every phase in the pipeline succeeded. */
  success:     boolean;
  /** Ordered phase results — always length 7 even when a phase is skipped. */
  phases:      MarcusPhaseResult[];
  /** ISO timestamp when the controller finished (success or failure). */
  completedAt: string;
}

// ─── Phase → model assignment ─────────────────────────────────────────────────
//
// Rationale:
//   UNDERSTAND/PLAN — structured JSON from a brief; low latency preferred → Maverick
//   DESIGN         — blueprint JSON; same structured reasoning → Maverick
//   BUILD          — full code generation; large context, thinking disabled → Super 120B
//   TEST           — static analysis JSON; brief output → Maverick
//   IMPROVE        — patched file JSON + prose; brief but precise → Maverick
//   REPORT         — prose completion message; minimal tokens → Maverick
//
// Override per-phase by passing `modelOverrides` to MarcusController.run().

const PHASE_MODEL_DEFAULTS: Record<MarcusAgentPhase, string> = {
  UNDERSTAND: MODELS.WEBSITE_V2_ARCHITECT,
  PLAN:       MODELS.WEBSITE_V2_ARCHITECT,
  DESIGN:     MODELS.WEBSITE_V2_ARCHITECT,
  BUILD:      MODELS.WEBSITE_V2_CODE_GEN,
  TEST:       MODELS.WEBSITE_V2_ARCHITECT,
  IMPROVE:    MODELS.WEBSITE_V2_ARCHITECT,
  REPORT:     MODELS.WEBSITE_V2_ARCHITECT,
};

// ─── Phase → max token budget ─────────────────────────────────────────────────
//
// BUILD needs the full budget because it generates complete file content.
// All other phases produce compact JSON or short prose.

const PHASE_MAX_TOKENS: Record<MarcusAgentPhase, number> = {
  UNDERSTAND: 1_024,
  PLAN:       2_048,
  DESIGN:     4_096,
  BUILD:      8_192,
  TEST:       2_048,
  IMPROVE:    4_096,
  REPORT:     1_024,
};

// ─── Log tag ──────────────────────────────────────────────────────────────────
const TAG = "[MARCUS]";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Extract the agent-scoped context slice from the controller context. */
function toAgentContext(
  ctx:         MarcusTaskContext,
  priorOutput: string | null,
): AgentMarcusTaskContext {
  const biz = ctx.businessContext ?? {};
  return {
    idea:             ctx.idea,
    companyName:      biz.companyName,
    industry:         biz.industry,
    targetAudience:   biz.targetAudience,
    businessGoal:     biz.businessGoal,
    brandPositioning: biz.brandPositioning,
    conversionGoal:   biz.conversionGoal,
    style:            ctx.style,
    tone:             ctx.tone,
    priorOutput:      priorOutput ?? undefined,
  };
}

/** Generate a short task ID for log correlation. */
function makeTaskId(): string {
  return `marcus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Phase executor ───────────────────────────────────────────────────────────
//
// Runs one phase of the Marcus pipeline:
//   1. Builds system + user prompts via the marcus-website-agent builders
//   2. Calls the model via callNvidia()
//   3. Returns a MarcusPhaseResult with output, duration, and any errors
//
// This is the single connection point for model calls — when you need to add
// streaming, telemetry, or retry logic, do it here, not in run().

async function executePhase(
  phase:         MarcusAgentPhase,
  ctx:           MarcusTaskContext,
  priorOutput:   string | null,
  modelOverride?: string,
): Promise<MarcusPhaseResult> {
  const events:   AgentEvent[] = [];
  const t0        = Date.now();
  const model     = modelOverride ?? PHASE_MODEL_DEFAULTS[phase];
  const maxTokens = PHASE_MAX_TOKENS[phase];

  // ── Log: phase started ─────────────────────────────────────────────────────
  logger.info({ tag: TAG, phase, model, userId: ctx.userId, projectId: ctx.projectId },
    `${TAG} phase started`);

  // ── Emit agent thought event ───────────────────────────────────────────────
  const startEvent = agentThought(
    "marcus",
    `Starting ${phase} phase`,
    { phase },
  );
  events.push(startEvent);

  // ── Build prompts ──────────────────────────────────────────────────────────
  const systemPrompt = buildMarcusSystemPrompt(phase);
  const userPrompt   = buildMarcusUserPrompt(phase, toAgentContext(ctx, priorOutput));

  // ── Call model ─────────────────────────────────────────────────────────────
  let output: string | null = null;

  try {
    const actionEvent = agentAction(
      "marcus",
      `Executing ${phase} phase`,
      { phase },
    );
    events.push(actionEvent);

    output = await callNvidia({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      maxTokens,
      temperature: phase === "BUILD" ? 0.4 : 0.6,
      _feature:   `marcus:${phase.toLowerCase()}`,
      _userId:    ctx.userId,
      _projectId: ctx.projectId,
    });

    const durationMs = Date.now() - t0;

    // ── Log: phase completed ─────────────────────────────────────────────────
    logger.info(
      { tag: TAG, phase, durationMs, userId: ctx.userId, projectId: ctx.projectId },
      `${TAG} phase completed`,
    );

    const successEvent = agentSuccess(
      "marcus",
      `${phase} phase completed`,
      [`${phase} output: ${output.slice(0, 80)}${output.length > 80 ? "…" : ""}`],
      { phase, duration: durationMs },
    );
    events.push(successEvent);

    return {
      phase,
      success:    true,
      output,
      durationMs,
      errors:     [],
      events,
    };

  } catch (err) {
    const durationMs  = Date.now() - t0;
    const message     = err instanceof Error ? err.message : String(err);

    // ── Log: phase failed ────────────────────────────────────────────────────
    logger.error(
      { tag: TAG, phase, durationMs, userId: ctx.userId, projectId: ctx.projectId, err },
      `${TAG} phase failed`,
    );

    const errorEvent = agentError(
      "marcus",
      `${phase} phase failed: ${message}`,
      "PHASE_EXECUTION_ERROR",
      { phase, duration: durationMs },
    );
    events.push(errorEvent);

    return {
      phase,
      success:    false,
      output:     null,
      durationMs,
      errors:     [message],
      events,
    };
  }
}

// ─── Skipped-phase sentinel ───────────────────────────────────────────────────
//
// When a phase is aborted because a prior phase failed, we still record an
// entry so `phases` is always length 7 and array-indexed lookups are stable.

function skippedPhase(phase: MarcusAgentPhase): MarcusPhaseResult {
  return {
    phase,
    success:    false,
    output:     null,
    durationMs: 0,
    errors:     ["Phase skipped — prior phase failed"],
    events:     [
      createAgentEvent("marcus", "error", `${phase} phase skipped`, { phase }),
    ],
  };
}

// ─── MarcusController ─────────────────────────────────────────────────────────
//
// Public entry point. Callers:
//   import { MarcusController } from "./marcus-controller"
//   const result = await MarcusController.run(taskContext)

export const MarcusController = {
  /**
   * Execute the full Marcus pipeline for a Website Studio task.
   *
   * Phases run sequentially. Each phase receives the prior phase's raw output
   * as `priorOutput` so later phases can parse and extend earlier work.
   *
   * The pipeline continues through failures in IMPROVE (recovery is built in),
   * but aborts on failures in UNDERSTAND, PLAN, DESIGN, or BUILD because later
   * phases are strictly dependent on those outputs.
   *
   * @param ctx           Task context carrying user identity + business brief
   * @param modelOverrides Optional per-phase model overrides (keyed by phase name)
   * @returns             Full ordered result with every phase result
   */
  async run(
    ctx:             MarcusTaskContext,
    modelOverrides?: Partial<Record<MarcusAgentPhase, string>>,
  ): Promise<MarcusControllerResult> {
    const taskId = makeTaskId();

    logger.info(
      { tag: TAG, taskId, userId: ctx.userId, projectId: ctx.projectId, idea: ctx.idea.slice(0, 120) },
      `${TAG} controller started`,
    );

    const results: MarcusPhaseResult[] = [];
    // Accumulates the full chain of prior phase outputs for context threading.
    // Each completed phase appends its output so later phases can see the full history.
    let cumulativePriorOutput: string | null = null;

    // ── Phase execution loop ─────────────────────────────────────────────────
    //
    // BLOCKING_PHASES: failure here means subsequent phases have no valid input
    // and should be skipped rather than producing garbage output.
    const BLOCKING_PHASES = new Set<MarcusAgentPhase>(["UNDERSTAND", "PLAN", "DESIGN", "BUILD"]);

    let aborted = false;

    for (const phase of MARCUS_AGENT_PHASES) {
      if (aborted) {
        results.push(skippedPhase(phase));
        continue;
      }

      const result = await executePhase(
        phase,
        ctx,
        cumulativePriorOutput,
        modelOverrides?.[phase],
      );

      results.push(result);

      if (result.success && result.output) {
        // Thread output forward: accumulate so each phase sees all prior work
        cumulativePriorOutput = cumulativePriorOutput
          ? `${cumulativePriorOutput}\n\n---\n${phase} OUTPUT:\n${result.output}`
          : `${phase} OUTPUT:\n${result.output}`;
      }

      if (!result.success && BLOCKING_PHASES.has(phase)) {
        logger.error(
          { tag: TAG, taskId, phase, userId: ctx.userId, projectId: ctx.projectId },
          `${TAG} blocking phase failed — aborting pipeline`,
        );
        aborted = true;
      }
    }

    // ── Final result ─────────────────────────────────────────────────────────
    const allSucceeded = results.every((r) => r.success);
    const completedAt  = new Date().toISOString();
    const totalMs      = results.reduce((sum, r) => sum + r.durationMs, 0);

    logger.info(
      {
        tag:        TAG,
        taskId,
        success:    allSucceeded,
        totalMs,
        userId:     ctx.userId,
        projectId:  ctx.projectId,
        phaseSummary: results.map((r) => ({
          phase:   r.phase,
          success: r.success,
          ms:      r.durationMs,
        })),
      },
      `${TAG} controller ${allSucceeded ? "completed" : "finished with failures"}`,
    );

    return {
      taskId,
      success:     allSucceeded,
      phases:      results,
      completedAt,
    };
  },

  // ─── Phase utilities ────────────────────────────────────────────────────────
  // Convenience accessors for callers that need a specific phase result.

  /** Get the result for a specific phase from a completed controller run. */
  getPhaseResult(
    result: MarcusControllerResult,
    phase:  MarcusAgentPhase,
  ): MarcusPhaseResult | undefined {
    return result.phases.find((r) => r.phase === phase);
  },

  /** Returns true when all phases up to and including the given phase succeeded. */
  succeededThrough(
    result: MarcusControllerResult,
    phase:  MarcusAgentPhase,
  ): boolean {
    const idx = MARCUS_AGENT_PHASES.indexOf(phase);
    if (idx === -1) return false;
    return result.phases.slice(0, idx + 1).every((r) => r.success);
  },
} as const;
