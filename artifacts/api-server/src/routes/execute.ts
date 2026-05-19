import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia, callNvidia, extractJson } from "../lib/nvidia";

const router = Router();

type ActionType = "GenerateAction" | "ModifyAction" | "AnalyzeAction" | "RecommendAction";
type TargetSystem = "Website" | "BusinessIntelligence" | "Workflows" | "Agents" | "Pricing" | "Copy" | "Strategy";

interface ExecutionPlan {
  actionType: ActionType;
  targetSystem: TargetSystem;
  targetSection?: string | null;
  reasoning: string;
  confidence: number;
  executionSteps: string[];
  estimatedImpact: string;
  requiresConfirmation: boolean;
}

const THINKING_MESSAGES: Record<ActionType, string[]> = {
  GenerateAction: [
    "Initializing generation architecture",
    "Loading business context into generation model",
    "Preparing structured output schema",
    "Launching content generation engine",
  ],
  ModifyAction: [
    "Loading target system state",
    "Analyzing modification scope and constraints",
    "Preparing surgical update plan",
    "Executing targeted system modification",
  ],
  AnalyzeAction: [
    "Collecting cross-system performance signals",
    "Running deep diagnostic scan",
    "Computing performance metrics and benchmarks",
    "Synthesizing actionable intelligence report",
  ],
  RecommendAction: [
    "Synthesizing business intelligence data",
    "Evaluating strategic options by impact",
    "Cross-referencing industry benchmarks",
    "Compiling ranked recommendation set",
  ],
};

const SYSTEM_LABELS: Record<string, string> = {
  Website: "Website Architect",
  BusinessIntelligence: "Business Intelligence",
  Workflows: "Workflow Builder",
  Agents: "AI Agents",
  Pricing: "Pricing Engine",
  Copy: "Copy Engine",
  Strategy: "Strategy Layer",
};

const CROSS_SYSTEM_IMPACT: Record<string, string[]> = {
  Website: ["Website Architect", "Live Preview", "Export Package"],
  BusinessIntelligence: ["BI Report", "AI Memory", "Cross-System Context"],
  Pricing: ["Website Pricing Section", "Revenue Model", "AI Memory"],
  Copy: ["Website Copy", "Brand Voice", "Conversion Flow"],
  Strategy: ["AI Copilot", "Recommendations", "Memory Context"],
  Workflows: ["Workflow Builder", "Automation Engine", "Agent Tasks"],
  Agents: ["Agent Store", "Agent Monitor", "Task Queue"],
};

// Local streaming helper that uses the centralized client but supports
// the custom per-chunk callback pattern used throughout this route.
async function streamExecute(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  onChunk: (c: string) => void
): Promise<string> {
  const body = await streamNvidia({ model, messages, temperature: 0.6, maxTokens });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let carry = "", full = "";

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
        const c = JSON.parse(data).choices?.[0]?.delta?.content;
        if (c) { full += c; onChunk(c); }
      } catch { /* fragment */ }
    }
  }
  return full;
}

// POST /api/execute — AI Execution Engine
router.post("/execute", requireAuth, async (req, res): Promise<void> => {
  const { intent, businessContext, websiteData } = req.body as {
    intent?: string;
    businessContext?: unknown;
    websiteData?: unknown;
  };

  if (!intent || typeof intent !== "string" || !intent.trim()) {
    res.status(400).json({ error: "intent is required" });
    return;
  }

  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const startTime = Date.now();
  const bi = businessContext as { industry?: string; targetMarket?: string; businessSnapshot?: string; metrics?: Record<string, number> } | null;

  try {
    // ─── Phase 1: Intent parsing ──────────────────────────────────────────────
    send({ phase: "thinking", message: "Parsing intent and loading execution context..." });
    await new Promise(r => setTimeout(r, 280));
    send({ phase: "thinking", message: "Mapping intent to action taxonomy..." });
    await new Promise(r => setTimeout(r, 280));
    send({ phase: "classifying" });

    // ─── Phase 2: Fast classification (non-streaming) ─────────────────────────
    let plan: ExecutionPlan;
    try {
      const raw = await callNvidia({
        model: MODELS.ORCHESTRATION,
        messages: [
          {
            role: "system",
            content: `You are STAGEONE's AI Execution Classifier. Map user intents to structured execution plans. Return ONLY valid JSON.

Schema:
{
  "actionType": "GenerateAction|ModifyAction|AnalyzeAction|RecommendAction",
  "targetSystem": "Website|BusinessIntelligence|Workflows|Agents|Pricing|Copy|Strategy",
  "targetSection": "hero|features|testimonials|pricing|cta|faq|footer|null",
  "reasoning": "1 sentence: why this action type and target system",
  "confidence": 0.95,
  "executionSteps": ["Specific step 1", "Specific step 2", "Specific step 3"],
  "estimatedImpact": "1 sentence: expected business outcome",
  "requiresConfirmation": false
}

Classification rules:
- ModifyAction: update/improve/fix/optimize EXISTING content
- GenerateAction: create/build/generate NEW content
- AnalyzeAction: analyze/evaluate/audit/review/assess performance
- RecommendAction: suggest/recommend/advise/strategize (no direct execution)
- targetSection: set ONLY when targeting a specific website section (hero/features/testimonials/pricing/cta/faq/footer), otherwise null
- requiresConfirmation: true only for destructive or irreversible actions`,
          },
          {
            role: "user",
            content: `Classify and plan: "${intent}"\nIndustry: ${bi?.industry ?? "Unknown"} | Has website: ${!!websiteData} | Has BI: ${!!bi}`,
          },
        ],
        temperature: 0.15,
        maxTokens: 400,
      });
      plan = extractJson(raw) as ExecutionPlan;
      // Sanitize null string
      if ((plan.targetSection as unknown) === "null") plan.targetSection = null;
    } catch {
      plan = {
        actionType: "RecommendAction",
        targetSystem: "Strategy",
        targetSection: null,
        reasoning: "Strategic advisory request — generating recommendations",
        confidence: 0.7,
        executionSteps: ["Analyzing business context", "Evaluating strategic options", "Generating ranked recommendations"],
        estimatedImpact: "Strategic clarity and prioritized action plan",
        requiresConfirmation: false,
      };
    }

    send({ phase: "classified", plan });
    await new Promise(r => setTimeout(r, 200));

    // ─── Phase 3: Execution ───────────────────────────────────────────────────
    const thinkingMsgs = THINKING_MESSAGES[plan.actionType] ?? THINKING_MESSAGES.RecommendAction;
    for (const msg of thinkingMsgs) {
      send({ phase: "executing", step: msg });
      await new Promise(r => setTimeout(r, 360));
    }

    const systemLabel = SYSTEM_LABELS[plan.targetSystem] ?? plan.targetSystem;
    const systemsUpdated = CROSS_SYSTEM_IMPACT[plan.targetSystem] ?? [systemLabel];

    send({ phase: "executing", step: `Applying changes to ${systemLabel}...` });

    let resultData: unknown = null;

    // ── Route to appropriate execution logic ──────────────────────────────────
    if (
      plan.actionType === "ModifyAction" &&
      plan.targetSystem === "Website" &&
      plan.targetSection &&
      plan.targetSection !== "null" &&
      websiteData
    ) {
      // ── Website Section Modification ────────────────────────────────────────
      const wd = websiteData as {
        sections?: Record<string, unknown>;
        brand?: { name?: string };
      };
      const currentSection = wd.sections?.[plan.targetSection];

      const SECTION_SCHEMAS: Record<string, string> = {
        hero: '{ "badge": "...", "headline": "...", "subheadline": "...", "ctaPrimary": "...", "ctaSecondary": "...", "socialProof": "..." }',
        features: '{ "title": "...", "subtitle": "...", "items": [6 items: { "icon": "Zap|Shield|Target|Rocket|Globe|Sparkles", "title": "...", "description": "..." }] }',
        pricing: '{ "title": "...", "subtitle": "...", "tiers": [3 tiers: { "name": "...", "price": "$X", "period": "/mo", "description": "...", "features": ["..."], "cta": "...", "highlighted": boolean, "badge": null }] }',
        cta: '{ "headline": "...", "subheadline": "...", "buttonText": "...", "subtext": "..." }',
        faq: '{ "title": "...", "items": [5 items: { "question": "...?", "answer": "..." }] }',
        testimonials: '{ "title": "...", "items": [3 items: { "quote": "...", "author": "...", "role": "...", "company": "...", "metric": null }] }',
        footer: '{ "tagline": "...", "columns": [{ "title": "...", "links": ["..."] }], "legal": "..." }',
      };

      const schema = SECTION_SCHEMAS[plan.targetSection] ?? '{ "content": "..." }';
      const prompt = `You are improving the "${plan.targetSection}" section of a website for "${wd.brand?.name ?? "a business"}".

EXECUTION INTENT: "${intent}"
INDUSTRY: ${bi?.industry ?? "SaaS"}  
TARGET MARKET: ${bi?.targetMarket ?? "Not specified"}
CURRENT SECTION: ${JSON.stringify(currentSection ?? {}, null, 1).slice(0, 600)}

Return ONLY valid JSON matching this exact schema: ${schema}

Apply improvements based on the intent. All text must be specific to this actual business — zero generic placeholders.`;

      const buf = await streamExecute(
        MODELS.EXECUTION,
        [
          { role: "system", content: "Elite conversion copywriter and website architect. Return ONLY valid JSON. No markdown, no code fences." },
          { role: "user", content: prompt },
        ],
        1400,
        c => send({ phase: "content", content: c })
      );

      try {
        resultData = { type: "section_update", section: plan.targetSection, data: extractJson(buf) };
      } catch {
        resultData = { type: "section_update", section: plan.targetSection, raw: buf };
      }

    } else if (plan.actionType === "AnalyzeAction") {
      // ── Analysis Execution ──────────────────────────────────────────────────
      const analysisPrompt = `Perform a deep ${plan.targetSystem} analysis for: "${intent}"

BUSINESS CONTEXT:
- Industry: ${bi?.industry ?? "Unknown"}
- Target Market: ${bi?.targetMarket ?? "Not specified"}
- Business Model: ${bi?.businessSnapshot ?? "Not analyzed yet"}
- AI Opportunity: ${bi?.metrics?.aiAdoptionOpportunity ?? "?"}%
- Automation Potential: ${bi?.metrics?.automationPotential ?? "?"}%
- Market Difficulty: ${bi?.metrics?.marketDifficulty ?? "?"}/10
${websiteData ? `- Website: ${(websiteData as { brand?: { name?: string } }).brand?.name ?? "exists"}` : "- Website: Not generated yet"}

Structure your response with these exact sections:

## Current State Assessment
(3 specific observations about the current state — reference actual data above)

## Critical Issues Identified
(4 specific issues with severity: CRITICAL / HIGH / MEDIUM + estimated impact)

## Immediate Actions (Priority Order)
(4 concrete actions ranked by impact, with estimated lift)

## Expected Business Impact
(Quantified outcomes — use metrics where possible)

Be specific. Reference the actual business context. No generic advice.`;

      await streamExecute(
        MODELS.EXECUTION,
        [
          { role: "system", content: "You are STAGEONE's AI Business Intelligence Engine. Provide sharp, specific, data-driven analysis. Use markdown." },
          { role: "user", content: analysisPrompt },
        ],
        1100,
        c => send({ phase: "content", content: c })
      );

      resultData = { type: "analysis", systemAnalyzed: plan.targetSystem };

    } else if (plan.actionType === "GenerateAction") {
      // ── Generation Execution ────────────────────────────────────────────────
      const genPrompt = `Create a complete ${plan.targetSystem} generation plan for: "${intent}"

BUSINESS CONTEXT:
- Industry: ${bi?.industry ?? "Unknown"}
- Target Market: ${bi?.targetMarket ?? "Not specified"}
- Business: ${bi?.businessSnapshot ?? "Not specified"}

Provide a detailed generation execution plan:

## What Will Be Generated
(Specific components and content to be created)

## Generation Architecture
(How each component is structured — specific to this business)

## Content Blueprint
(Key messages, CTAs, value propositions — tailored to the ICP)

## Launch Sequence
(Step-by-step execution order with dependencies)

## Success Metrics
(How to measure if generation achieved the business goal)

Make it highly specific to this actual business. No generic templates.`;

      await streamExecute(
        MODELS.EXECUTION,
        [
          { role: "system", content: "You are STAGEONE's AI Generation Architect. Build precise, actionable generation plans for real businesses." },
          { role: "user", content: genPrompt },
        ],
        1000,
        c => send({ phase: "content", content: c })
      );

      resultData = { type: "generation_plan", targetSystem: plan.targetSystem };

    } else {
      // ── Recommendations (default) ───────────────────────────────────────────
      const recPrompt = `Generate strategic recommendations for: "${intent}"

BUSINESS CONTEXT:
- Industry: ${bi?.industry ?? "Unknown"}
- Target Market: ${bi?.targetMarket ?? "Not specified"}
- Business: ${bi?.businessSnapshot ?? "Not analyzed yet"}
- Market Difficulty: ${bi?.metrics?.marketDifficulty ?? "?"}/10
- Revenue Scalability: ${bi?.metrics?.revenueScalability ?? "?"}/10
- AI Opportunity: ${bi?.metrics?.aiAdoptionOpportunity ?? "?"}%

Provide strategic guidance:

## Priority Actions
(4-5 specific recommendations ranked by impact — reference actual metrics)

## Strategic Rationale
(Why these recommendations specifically for this business and industry)

## Execution Timeline
(When and how to implement each recommendation)

## Risk Factors
(Specific risks to mitigate given the market difficulty and business model)

## Expected ROI
(Quantified impact of implementing these recommendations)

Be direct. Reference the actual business data. No generic business advice.`;

      await streamExecute(
        MODELS.EXECUTION,
        [
          { role: "system", content: "You are STAGEONE's AI Strategy Engine — a senior McKinsey-level advisor with deep AI and SaaS expertise. Use markdown." },
          { role: "user", content: recPrompt },
        ],
        1100,
        c => send({ phase: "content", content: c })
      );

      resultData = { type: "recommendations", targetSystem: plan.targetSystem };
    }

    const duration = Date.now() - startTime;
    send({
      phase: "completed",
      result: { data: resultData, systemsUpdated },
      duration,
    });

  } catch (err) {
    req.log?.error({ err }, "Execute error");
    send({ phase: "error", message: String(err) });
  }

  res.end();
});

export default router;
