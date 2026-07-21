import { Router } from "express";
import { db, aiMemoryTable, projectsTable, subscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson } from "../lib/nvidia";
import { getLanguageInstruction } from "../lib/language";
import { onBusinessIntelligenceComplete } from "../lib/business-graph";
import { logEventFireForget } from "../lib/log-event";
import { trackUsageFireForget } from "../lib/usage";
import { getBiMemoryContext, storeBiMemory } from "@workspace/db";

const router = Router();

// ─── BI Schema Validation & Repair ────────────────────────────────────────────
// Validates and repairs BI JSON output to ensure all required fields exist
// with safe defaults. Never hallucinates business data.

interface BIConfidence {
  overall: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

interface BIModuleContext {
  website: { positioning: string; conversionGoal: string };
  chatbot: { primaryRole: string; requiredCapabilities: string };
  automation: { highestValueWorkflow: string; recommendedIntegrations: string[] };
  execution: { recommendedAgents: string[]; prioritySequence: string[] };
}

interface BIEvidence {
  facts: string[];
  inferences: string[];
  hypotheses: string[];
  unknowns: string[];
}

interface BIQualityScore {
  overall: number;
  completeness: number;
  evidenceStrength: number;
  actionability: number;
}

interface BIValidationMeta {
  validatedAt: string;
  validationLevel: "IDEA" | "SIGNAL" | "MVP" | "TRACTION" | "SCALE";
  requiresHumanValidation: string[];
}

interface BIValidatedOutput {
  industry: string;
  metrics: {
    marketDifficulty: number;
    automationPotential: number;
    revenueScalability: number;
    operationalComplexity: number;
    aiAdoptionOpportunity: number;
  };
  businessSnapshot: string;
  targetMarket: string;
  strategicInsights: {
    growthBottleneck: string;
    fastestChannel: string;
    highestLeverageAutomation: string;
    operationalRisk: string;
  };
  competitiveAdvantage: {
    differentiation: string;
    defensibility: string;
    scalabilityEdge: string;
  };
  growthPlan: string[];
  websitePages: string[];
  chatbotRole: string;
  automations: string[];
  recommendedStack: {
    frontend: string[];
    backend: string[];
    automation: string[];
    crm: string;
    payments: string;
  };
  confidence: BIConfidence;
  criticalUnknowns: string[];
  decisionPriorities: string[];
  moduleContext: BIModuleContext;
  evidence: BIEvidence;
  qualityScore: BIQualityScore;
  validation: BIValidationMeta;
}

const REQUIRED_INDUSTRIES = [
  "SaaS", "E-commerce", "Healthcare", "Cybersecurity", "Education",
  "Marketplace", "Agency", "Fintech", "Creator Economy"
] as const;

// Helper to clamp numbers to range
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function validateAndRepairBI(raw: unknown, userIdea: string): BIValidatedOutput {
  const data = raw as Record<string, unknown>;

  // Helper to safely get nested values - handles 0 and empty string as valid
  const get = <T>(obj: Record<string, unknown>, path: string, fallback: T): T => {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return fallback;
      }
    }
    // If value is null/undefined, use fallback; otherwise use the value (including 0, "")
    return (current === null || current === undefined) ? fallback : (current as T);
  };

  // Helper to clamp numeric values
  const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

  // Validate industry
  const industry = get(data, "industry", "SaaS");
  const validIndustry = REQUIRED_INDUSTRIES.includes(industry as typeof REQUIRED_INDUSTRIES[number])
    ? industry
    : "SaaS";

  // Validate metrics with safe bounds - use explicit null/undefined check
  const rawMarketDifficulty = get(data, "metrics.marketDifficulty", 5);
  const rawAutomationPotential = get(data, "metrics.automationPotential", 50);
  const rawRevenueScalability = get(data, "metrics.revenueScalability", 5);
  const rawOperationalComplexity = get(data, "metrics.operationalComplexity", 5);
  const rawAiAdoptionOpportunity = get(data, "metrics.aiAdoptionOpportunity", 50);

  const metrics = {
    marketDifficulty: clamp(Number(rawMarketDifficulty), 1, 10),
    automationPotential: clamp(Number(rawAutomationPotential), 1, 100),
    revenueScalability: clamp(Number(rawRevenueScalability), 1, 10),
    operationalComplexity: clamp(Number(rawOperationalComplexity), 1, 10),
    aiAdoptionOpportunity: clamp(Number(rawAiAdoptionOpportunity), 1, 100),
  };

  // Validate string fields with UNKNOWN fallbacks
  const businessSnapshot = get(data, "businessSnapshot", "UNKNOWN — insufficient information to generate business snapshot");
  const targetMarket = get(data, "targetMarket", "UNKNOWN — target market not specified");

  // Validate strategicInsights
  const strategicInsights = {
    growthBottleneck: get(data, "strategicInsights.growthBottleneck", "UNKNOWN — growth bottleneck not identified"),
    fastestChannel: get(data, "strategicInsights.fastestChannel", "UNKNOWN — fastest channel not identified"),
    highestLeverageAutomation: get(data, "strategicInsights.highestLeverageAutomation", "UNKNOWN — automation opportunity not identified"),
    operationalRisk: get(data, "strategicInsights.operationalRisk", "UNKNOWN — operational risk not identified"),
  };

  // Validate competitiveAdvantage
  const competitiveAdvantage = {
    differentiation: get(data, "competitiveAdvantage.differentiation", "UNKNOWN — differentiation not specified"),
    defensibility: get(data, "competitiveAdvantage.defensibility", "UNKNOWN — defensibility not specified"),
    scalabilityEdge: get(data, "competitiveAdvantage.scalabilityEdge", "UNKNOWN — scalability edge not specified"),
  };

  // Validate growthPlan
  const growthPlan = Array.isArray(data.growthPlan)
    ? data.growthPlan.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — growth plan not generated"];

  // Validate websitePages
  const websitePages = Array.isArray(data.websitePages)
    ? data.websitePages.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — website pages not generated"];

  // Validate chatbotRole
  const chatbotRole = get(data, "chatbotRole", "UNKNOWN — chatbot role not specified");

  // Validate automations
  const automations = Array.isArray(data.automations)
    ? data.automations.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — automations not generated"];

  // Validate recommendedStack
  const recommendedStack = {
    frontend: Array.isArray(get(data, "recommendedStack.frontend", [])) ? get(data, "recommendedStack.frontend", []) : ["React", "Tailwind CSS", "Vercel"],
    backend: Array.isArray(get(data, "recommendedStack.backend", [])) ? get(data, "recommendedStack.backend", []) : ["Node.js", "PostgreSQL"],
    automation: Array.isArray(get(data, "recommendedStack.automation", [])) ? get(data, "recommendedStack.automation", []) : ["Zapier", "HubSpot"],
    crm: get(data, "recommendedStack.crm", "HubSpot"),
    payments: get(data, "recommendedStack.payments", "Stripe"),
  };

  // Validate confidence
  const confidenceRaw = get(data, "confidence", { overall: "LOW", reason: "Model did not provide confidence assessment" }) as Record<string, unknown>;
  const confidence: BIConfidence = {
    overall: (confidenceRaw.overall === "HIGH" || confidenceRaw.overall === "MEDIUM" || confidenceRaw.overall === "LOW")
      ? confidenceRaw.overall
      : "LOW",
    reason: typeof confidenceRaw.reason === "string" && confidenceRaw.reason.length > 0
      ? confidenceRaw.reason
      : "Model did not provide confidence assessment",
  };

  // Validate criticalUnknowns
  const criticalUnknowns = Array.isArray(data.criticalUnknowns)
    ? data.criticalUnknowns.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — critical unknowns not identified"];

  // Validate decisionPriorities
  const decisionPriorities = Array.isArray(data.decisionPriorities)
    ? data.decisionPriorities.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — decision priorities not identified"];

  // Validate moduleContext
  const moduleContextRaw = get(data, "moduleContext", {}) as Record<string, unknown>;
  const moduleContext: BIModuleContext = {
    website: {
      positioning: get(moduleContextRaw, "website.positioning", "UNKNOWN — positioning not specified"),
      conversionGoal: get(moduleContextRaw, "website.conversionGoal", "UNKNOWN — conversion goal not specified"),
    },
    chatbot: {
      primaryRole: get(moduleContextRaw, "chatbot.primaryRole", "UNKNOWN — primary role not specified"),
      requiredCapabilities: get(moduleContextRaw, "chatbot.requiredCapabilities", "UNKNOWN — capabilities not specified"),
    },
    automation: {
      highestValueWorkflow: get(moduleContextRaw, "automation.highestValueWorkflow", "UNKNOWN — workflow not specified"),
      recommendedIntegrations: Array.isArray(get(moduleContextRaw, "automation.recommendedIntegrations", []))
        ? get(moduleContextRaw, "automation.recommendedIntegrations", [])
        : [],
    },
    execution: {
      recommendedAgents: Array.isArray(get(moduleContextRaw, "execution.recommendedAgents", []))
        ? get(moduleContextRaw, "execution.recommendedAgents", [])
        : [],
      prioritySequence: Array.isArray(get(moduleContextRaw, "execution.prioritySequence", []))
        ? get(moduleContextRaw, "execution.prioritySequence", [])
        : [],
    },
  };

  // Validate evidence
  const evidenceRaw = get(data, "evidence", {}) as Record<string, unknown>;
  const evidence: BIEvidence = {
    facts: Array.isArray(evidenceRaw.facts) ? evidenceRaw.facts.filter((x): x is string => typeof x === "string") : [],
    inferences: Array.isArray(evidenceRaw.inferences) ? evidenceRaw.inferences.filter((x): x is string => typeof x === "string") : [],
    hypotheses: Array.isArray(evidenceRaw.hypotheses) ? evidenceRaw.hypotheses.filter((x): x is string => typeof x === "string") : [],
    unknowns: Array.isArray(evidenceRaw.unknowns) ? evidenceRaw.unknowns.filter((x): x is string => typeof x === "string") : [],
  };

  // If evidence is empty, populate unknowns from criticalUnknowns
  if (evidence.facts.length === 0 && evidence.inferences.length === 0 && evidence.hypotheses.length === 0 && evidence.unknowns.length === 0) {
    evidence.unknowns = [...criticalUnknowns];
  }

  return {
    industry: validIndustry,
    metrics,
    businessSnapshot,
    targetMarket,
    strategicInsights,
    competitiveAdvantage,
    growthPlan,
    websitePages,
    chatbotRole,
    automations,
    recommendedStack,
    confidence,
    criticalUnknowns,
    decisionPriorities,
    moduleContext,
    evidence,
    qualityScore: {
      overall: confidence.overall === "HIGH" ? 85 : confidence.overall === "MEDIUM" ? 65 : 45,
      completeness: 80,
      evidenceStrength: evidence.facts.length > 0 ? 70 : 40,
      actionability: 70,
    },
    validation: {
      validatedAt: new Date().toISOString(),
      validationLevel: "IDEA",
      requiresHumanValidation: criticalUnknowns,
    },
  };
}

// ─── False Intelligence Detection ──────────────────────────────────────────────
// Scans output for hallucinated claims and converts them to hypotheses

function detectFalseIntelligence(output: BIValidatedOutput, userIdea: string): BIValidatedOutput {
  const suspiciousPatterns = [
    // Specific numbers without evidence
    { pattern: /\$\d+[KM]?\s*(ARR|MRR|revenue)/i, field: "businessSnapshot", type: "revenue" },
    { pattern: /\d+%\s*(conversion|churn|retention|growth)/i, field: "metrics", type: "metric" },
    { pattern: /\d+\s*(customers?|users?|clinics?|companies?)/i, field: "targetMarket", type: "customer_count" },
    // Named competitors without evidence
    { pattern: /(Salesforce|HubSpot|Stripe|Shopify|Atlassian|Microsoft|Google|Amazon|Oracle|SAP)\s+(is|has|uses|offers)/i, field: "competitiveAdvantage", type: "competitor_claim" },
    // Specific tool claims
    { pattern: /(Clay|Apollo|Outreach|Segment|PostHog|Retool|Zapier|Make|n8n)\s+(integration|automates|connects)/i, field: "automations", type: "tool_claim" },
  ];

  const hypotheses: string[] = [];
  const unknowns: string[] = [];

  // Check businessSnapshot for revenue claims
  suspiciousPatterns.forEach(({ pattern, field, type }) => {
    const value = JSON.stringify(output[field as keyof BIValidatedOutput]);
    if (pattern.test(value)) {
      hypotheses.push(`Hypothesis: ${field} contains unverified ${type} claim — requires validation`);
      unknowns.push(`Validation needed: ${field} ${type} claim`);
    }
  });

  // Merge into evidence
  output.evidence.hypotheses = [...new Set([...output.evidence.hypotheses, ...hypotheses])];
  output.evidence.unknowns = [...new Set([...output.evidence.unknowns, ...unknowns])];

  // If confidence is HIGH but we found suspicious patterns, downgrade
  if (output.confidence.overall === "HIGH" && (hypotheses.length > 0 || unknowns.length > 0)) {
    output.confidence.overall = "MEDIUM";
    output.confidence.reason = "Downgraded due to unverified claims detected";
  }

  return output;
}

// ─── Confidence Calculation ────────────────────────────────────────────────────
// Computes confidence based on input richness and output completeness

function calculateConfidence(userIdea: string, output: BIValidatedOutput): BIConfidence {
  let score = 0;
  const reasons: string[] = [];

  // Input richness
  const ideaWords = userIdea.trim().split(/\s+/).length;
  if (ideaWords > 50) { score += 30; reasons.push("detailed input"); }
  else if (ideaWords > 20) { score += 20; reasons.push("moderate input"); }
  else if (ideaWords > 10) { score += 10; reasons.push("basic input"); }
  else { reasons.push("minimal input"); }

  // Industry clarity
  if (output.industry !== "SaaS" || userIdea.toLowerCase().includes("saas")) {
    score += 15; reasons.push("clear industry");
  }

  // Output completeness
  const unknownCount = [
    output.businessSnapshot,
    output.targetMarket,
    output.strategicInsights.growthBottleneck,
    output.strategicInsights.fastestChannel,
    output.strategicInsights.highestLeverageAutomation,
    output.strategicInsights.operationalRisk,
  ].filter(v => v.startsWith("UNKNOWN")).length;

  if (unknownCount === 0) { score += 25; reasons.push("complete output"); }
  else if (unknownCount <= 2) { score += 15; reasons.push("mostly complete"); }
  else { reasons.push(`${unknownCount} unknown fields`); }

  // Evidence presence
  if (output.evidence.facts.length > 0) { score += 10; reasons.push("has facts"); }
  if (output.evidence.inferences.length > 0) { score += 5; reasons.push("has inferences"); }

  // Determine overall
  let overall: "HIGH" | "MEDIUM" | "LOW";
  if (score >= 70) overall = "HIGH";
  else if (score >= 40) overall = "MEDIUM";
  else overall = "LOW";

  return {
    overall,
    reason: reasons.length > 0 ? reasons.join("; ") : "Insufficient information for assessment",
  };
}

// ─── BI Quality Score ──────────────────────────────────────────────────────────
// Computes quality metrics for the BI output

function calculateQualityScore(output: BIValidatedOutput, userIdea: string): BIQualityScore {
  // Completeness: all schema fields present, moduleContext filled, growthPlan populated
  let completeness = 0;
  const totalFields = 20;
  let presentFields = 0;

  // Check core fields
  const coreFields = [
    output.industry,
    output.businessSnapshot,
    output.targetMarket,
    output.strategicInsights.growthBottleneck,
    output.strategicInsights.fastestChannel,
    output.strategicInsights.highestLeverageAutomation,
    output.strategicInsights.operationalRisk,
    output.competitiveAdvantage.differentiation,
    output.competitiveAdvantage.defensibility,
    output.competitiveAdvantage.scalabilityEdge,
  ];
  presentFields += coreFields.filter(v => !v.startsWith("UNKNOWN")).length;

  // Check growthPlan
  if (output.growthPlan.length >= 3) presentFields += 2;
  else if (output.growthPlan.length > 0) presentFields += 1;

  // Check moduleContext
  const mc = output.moduleContext;
  if (!mc.website.positioning.startsWith("UNKNOWN")) presentFields++;
  if (!mc.website.conversionGoal.startsWith("UNKNOWN")) presentFields++;
  if (!mc.chatbot.primaryRole.startsWith("UNKNOWN")) presentFields++;
  if (!mc.chatbot.requiredCapabilities.startsWith("UNKNOWN")) presentFields++;
  if (!mc.automation.highestValueWorkflow.startsWith("UNKNOWN")) presentFields++;
  if (mc.automation.recommendedIntegrations.length > 0) presentFields++;
  if (mc.execution.recommendedAgents.length > 0) presentFields++;
  if (mc.execution.prioritySequence.length > 0) presentFields++;

  // Check metrics
  presentFields += 5; // metrics always present

  completeness = Math.round((presentFields / totalFields) * 100);

  // Evidence Strength: facts present, few assumptions
  let evidenceStrength = 0;
  const totalEvidence = output.evidence.facts.length + output.evidence.inferences.length + output.evidence.hypotheses.length + output.evidence.unknowns.length;
  if (totalEvidence > 0) {
    const factRatio = output.evidence.facts.length / totalEvidence;
    const hypothesisRatio = output.evidence.hypotheses.length / totalEvidence;
    if (factRatio >= 0.5) evidenceStrength = 100;
    else if (factRatio >= 0.3) evidenceStrength = 70;
    else if (hypothesisRatio >= 0.5) evidenceStrength = 30;
    else evidenceStrength = 50;
  } else {
    evidenceStrength = 20;
  }

  // Actionability: named tools, measurable actions, timeframes
  let actionability = 0;
  let actionScore = 0;
  // Growth plan with timeframes
  const hasTimeframes = output.growthPlan.some(p => /Phase \d|\(0-|\(3-|\(6-|\(12-|\(18-/.test(p));
  if (hasTimeframes) actionScore += 30;
  // Named tools in automations
  const namedTools = output.automations.filter(a => /(Zapier|HubSpot|Salesforce|Stripe|Slack|Notion|Airtable|Make|n8n|Clay|Apollo|Outreach|Segment|PostHog|Retool)/i.test(a)).length;
  if (namedTools >= 2) actionScore += 30;
  else if (namedTools >= 1) actionScore += 15;
  // Measurable targets in growth plan
  const measurableTargets = output.growthPlan.filter(p => /\d+%|\$\d+|\d+x|\d+ (customers?|users?|clinics?)/i.test(p)).length;
  if (measurableTargets >= 2) actionScore += 25;
  else if (measurableTargets >= 1) actionScore += 15;
  // Module context specificity
  if (!output.moduleContext.automation.highestValueWorkflow.startsWith("UNKNOWN")) actionScore += 15;
  if (!output.moduleContext.website.conversionGoal.startsWith("UNKNOWN")) actionScore += 10;

  actionability = Math.min(100, actionScore);

  // Overall quality score (weighted average)
  const overall = Math.round(completeness * 0.4 + evidenceStrength * 0.3 + actionability * 0.3);

  return {
    overall,
    completeness,
    evidenceStrength,
    actionability,
  };
}

// ─── Validation Metadata ───────────────────────────────────────────────────────
// Adds validation level and human validation requirements

function addValidationMetadata(output: BIValidatedOutput, userIdea: string): BIValidatedOutput {
  // Determine validation level based on evidence
  let validationLevel: "IDEA" | "SIGNAL" | "MVP" | "TRACTION" | "SCALE" = "IDEA";

  const fullText = JSON.stringify(output).toLowerCase();
  const hasCustomerConversations = /conversation|interview|survey|feedback|beta|pilot|early access/i.test(fullText);
  const hasMvp = /mvp|minimum viable|prototype|demo|test version/i.test(fullText);
  const hasPayingUsers = /paying|revenue|subscription|mrr|arr|customer.*pay/i.test(fullText);
  const hasScale = /scale|growth|expansion|series [abc]|funding round/i.test(fullText);

  if (hasScale && hasPayingUsers) validationLevel = "SCALE";
  else if (hasPayingUsers) validationLevel = "TRACTION";
  else if (hasMvp) validationLevel = "MVP";
  else if (hasCustomerConversations) validationLevel = "SIGNAL";
  else validationLevel = "IDEA";

  // Determine what requires human validation
  const requiresHumanValidation: string[] = [];

  if (output.evidence.hypotheses.length > 0) {
    requiresHumanValidation.push("Verify all hypotheses with market research");
  }
  if (output.criticalUnknowns.some(u => !u.startsWith("UNKNOWN"))) {
    requiresHumanValidation.push("Resolve critical unknowns before execution");
  }
  if (output.moduleContext.website.positioning.startsWith("UNKNOWN")) {
    requiresHumanValidation.push("Define website positioning and conversion goal");
  }
  if (output.moduleContext.automation.highestValueWorkflow.startsWith("UNKNOWN")) {
    requiresHumanValidation.push("Identify highest-value automation workflow");
  }
  if (output.moduleContext.execution.recommendedAgents.length === 0) {
    requiresHumanValidation.push("Define required execution agents");
  }
  if (validationLevel === "IDEA") {
    requiresHumanValidation.push("Conduct customer discovery to move beyond IDEA stage");
  }

  output.validation = {
    validatedAt: new Date().toISOString(),
    validationLevel,
    requiresHumanValidation,
  };

  return output;
}

// ─── Repair BI Output ──────────────────────────────────────────────────────────
// Second-pass repair for missing important fields

async function repairBIOutput(missingFields: string[], originalOutput: BIValidatedOutput, userIdea: string): Promise<Partial<BIValidatedOutput>> {
  if (missingFields.length === 0) return {};

  const repairPrompt = `You are repairing an incomplete business intelligence report.

Do not rewrite existing information.

Only fill missing fields.

Return ONLY JSON.

Missing fields:
${missingFields.join(", ")}

Existing report:
${JSON.stringify(originalOutput, null, 2)}`;

  try {
    const streamBody = await streamNvidia({
      model: MODELS.BUSINESS_INTELLIGENCE,
      messages: [
        { role: "system", content: "You are a precise JSON repair agent. Output only the missing fields as valid JSON." },
        { role: "user", content: repairPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
      nvextParams: { thinking: { enabled: false } },
    });

    const decoder = new TextDecoder();
    const reader = streamBody.getReader();
    let contentBuffer = "";
    let lineCarryover = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = lineCarryover + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      lineCarryover = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) contentBuffer += content;
        } catch { /* ignore */ }
      }
    }

    if (lineCarryover.startsWith("data: ")) {
      const data = lineCarryover.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) contentBuffer += content;
        } catch { /* ignore */ }
      }
    }

    const repaired = extractJson(contentBuffer) as Record<string, unknown>;
    return repaired as Partial<BIValidatedOutput>;
  } catch (err) {
    console.error("[BI Repair] Failed:", err);
    return {};
  }
}

// ─── Industry-Specific Reasoning Stages ──────────────────────────────────────
const INDUSTRY_REASONING: Record<string, string[]> = {
  Fintech: [
    "Mapping regulatory compliance requirements...",
    "Profiling onboarding friction patterns...",
    "Evaluating enterprise credibility signals...",
    "Benchmarking fintech competitive landscape...",
    "Modeling ARR growth trajectory...",
    "Recommending banking-grade infrastructure...",
  ],
  Cybersecurity: [
    "Mapping threat intelligence requirements...",
    "Profiling enterprise trust architecture...",
    "Evaluating SOC2/ISO compliance posture...",
    "Analyzing security competitive positioning...",
    "Detecting operational scalability risks...",
    "Recommending security-first infrastructure...",
  ],
  SaaS: [
    "Analyzing product-led growth signals...",
    "Profiling ICP and market segmentation...",
    "Evaluating PLG vs. sales-led motion...",
    "Benchmarking SaaS competitive moats...",
    "Modeling ARR expansion trajectory...",
    "Recommending dev-grade infrastructure...",
  ],
  Healthcare: [
    "Evaluating HIPAA compliance requirements...",
    "Profiling clinical credibility signals...",
    "Analyzing patient acquisition channels...",
    "Benchmarking telehealth market position...",
    "Modeling patient growth trajectory...",
    "Recommending HIPAA-compliant infrastructure...",
  ],
  Education: [
    "Analyzing learning outcome metrics...",
    "Profiling student acquisition channels...",
    "Evaluating cohort conversion patterns...",
    "Benchmarking EdTech competitive landscape...",
    "Modeling enrollment growth trajectory...",
    "Recommending scalable learning infrastructure...",
  ],
  Marketplace: [
    "Analyzing dual-sided trust dynamics...",
    "Profiling buyer and seller acquisition...",
    "Evaluating supply-demand liquidity...",
    "Benchmarking marketplace competitive moats...",
    "Modeling GMV growth trajectory...",
    "Recommending marketplace infrastructure...",
  ],
  Agency: [
    "Evaluating portfolio positioning signals...",
    "Profiling enterprise client acquisition...",
    "Analyzing service differentiation vectors...",
    "Benchmarking agency market positioning...",
    "Modeling retainer growth trajectory...",
    "Recommending agency operations infrastructure...",
  ],
  "E-commerce": [
    "Analyzing DTC conversion signals...",
    "Profiling customer acquisition channels...",
    "Evaluating AOV and LTV patterns...",
    "Benchmarking e-commerce competitive landscape...",
    "Modeling revenue growth trajectory...",
    "Recommending e-commerce infrastructure...",
  ],
  default: [
    "Profiling industry landscape...",
    "Analyzing business model structure...",
    "Evaluating strategic opportunities...",
    "Benchmarking competitive position...",
    "Mapping growth trajectory...",
    "Recommending infrastructure stack...",
  ],
};

// ─── Cross-System Awareness Context Builder ───────────────────────────────────
async function buildCrossSystemContext(userId: string): Promise<string> {
  let context = "";

  try {
    const [memories, recentProjects] = await Promise.all([
      db.select().from(aiMemoryTable).where(eq(aiMemoryTable.userId, userId))
        .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt)).limit(20),
      db.select({
        id: projectsTable.id,
        title: projectsTable.title,
        businessIdea: projectsTable.businessIdea,
        output: projectsTable.output,
        createdAt: projectsTable.createdAt,
      }).from(projectsTable).where(eq(projectsTable.userId, userId))
        .orderBy(desc(projectsTable.createdAt)).limit(3),
    ]);

    if (memories.length > 0) {
      const byImportance = memories.filter(m => m.importance >= 4);
      const rest = memories.filter(m => m.importance < 4);
      const sorted = [...byImportance, ...rest];
      const memoryLines = sorted.map(m => `- [${m.source}|importance:${m.importance}] ${m.key}: ${m.value}`).join("\n");
      context += `\n\nUSER INTELLIGENCE MEMORY (${memories.length} entries — apply all context):\n${memoryLines}`;
    }

    if (recentProjects.length > 0) {
      const projectLines = recentProjects.map(p => {
        const output = p.output as Record<string, unknown> | null;
        const industry = output?.industry ?? "Unknown";
        return `- "${p.title}" (${industry}): ${p.businessIdea?.slice(0, 120) ?? "N/A"}`;
      }).join("\n");
      context += `\n\nPREVIOUS BUSINESS ANALYSES (cross-system awareness):\n${projectLines}\nApply pattern recognition across these to inform current analysis. Identify if this new idea relates to, complements, or competes with prior work.`;
    }
  } catch {
    // Non-fatal — continue without cross-system context
  }

  return context;
}

// ─── Auto-Memory Extraction ────────────────────────────────────────────────────
async function autoSaveMemories(userId: string, data: Record<string, unknown>, idea: string): Promise<void> {
  try {
    const entries: Array<{ key: string; value: string; importance: number }> = [];

    if (data.industry && typeof data.industry === "string") {
      entries.push({ key: "last_industry", value: data.industry, importance: 4 });
      entries.push({ key: `industry_experience_${data.industry.toLowerCase().replace(/\s+/g, "_")}`, value: `Analyzed ${data.industry} business: ${idea.slice(0, 100)}`, importance: 3 });
    }

    const output = data as {
      businessSnapshot?: string;
      strategicInsights?: { growthBottleneck?: string; fastestChannel?: string };
      recommendedStack?: { crm?: string; payments?: string; automation?: string[] };
      metrics?: { automationPotential?: number; revenueScalability?: number };
    };

    if (output.businessSnapshot) {
      entries.push({ key: "last_business_model", value: output.businessSnapshot.slice(0, 200), importance: 5 });
    }
    if (output.strategicInsights?.growthBottleneck) {
      entries.push({ key: "recurring_growth_bottleneck", value: output.strategicInsights.growthBottleneck.slice(0, 200), importance: 4 });
    }
    if (output.strategicInsights?.fastestChannel) {
      entries.push({ key: "proven_growth_channel", value: output.strategicInsights.fastestChannel.slice(0, 200), importance: 3 });
    }
    if (output.recommendedStack?.crm) {
      entries.push({ key: "preferred_crm", value: output.recommendedStack.crm, importance: 3 });
    }
    if (output.recommendedStack?.automation && Array.isArray(output.recommendedStack.automation)) {
      entries.push({ key: "preferred_automation_stack", value: output.recommendedStack.automation.join(", "), importance: 3 });
    }
    if (output.metrics?.automationPotential !== undefined) {
      const level = output.metrics.automationPotential >= 70 ? "high" : output.metrics.automationPotential >= 40 ? "medium" : "low";
      entries.push({ key: "automation_maturity_target", value: `${level} (${output.metrics.automationPotential}% potential)`, importance: 3 });
    }

    for (const entry of entries) {
      await db.insert(aiMemoryTable).values({
        userId,
        key: entry.key,
        value: entry.value,
        importance: entry.importance,
        source: "ai",
        context: { idea: idea.slice(0, 200), auto_extracted: true },
      }).onConflictDoNothing();
    }
  } catch {
    // Non-fatal — memory save failure doesn't affect generation
  }
}

// ─── System Prompt ─────────────────────────────────────────────────────────────
const baseSystemPrompt = `You are STAGEONE, an elite AI Business Operating System staffed by ex-McKinsey, ex-a16z, and ex-YC operators. You maintain deep cross-system awareness — understanding how business models, website structures, automation workflows, AI agents, and monetization systems interconnect.

INDUSTRIES:
SaaS | E-commerce | Healthcare | Cybersecurity | Education | Marketplace | Agency | Fintech | Creator Economy

INTELLIGENCE STANDARDS:
- Reference real named tools, platforms, and companies (e.g. "HubSpot", "Stripe", "Retool", "Segment", "PostHog")
- Include specific metrics, percentages, and timeframes (e.g. "CAC < $120", "60-day payback", "3x NRR")
- Use precise industry terminology (CAC, LTV, NDR, GMV, ARR, churn, payback period)
- Identify non-obvious growth channels and automation opportunities
- Competitive analysis must name real incumbent competitors
- Apply cross-system reasoning: how does the business model affect the website structure? How do automations reduce operational risk?

EVIDENCE DISCIPLINE:
You must separate every claim into one of four categories:
- FACT: directly known from user input or provided context
- INFERENCE: reasonable interpretation based on available evidence
- HYPOTHESIS: assumption requiring validation
- UNKNOWN: information unavailable

Never present assumptions as facts. Label uncertain claims explicitly.

CONFIDENCE LAYER:
Every strategic recommendation must internally evaluate confidence. Include in output:
"confidence": {
  "overall": "HIGH|MEDIUM|LOW",
  "reason": "explain why"
}

ANTI-HALLUCINATION RULES:
- Never invent customer data
- Never claim a company uses a strategy without evidence
- Never fabricate market statistics
- Never create fake competitor advantages
When uncertain, state uncertainty explicitly.

OPERATIONAL INTELLIGENCE:
BI output must help downstream STAGEONE modules. The analysis must consider:

Website Architect:
- required pages
- conversion flow
- CTA strategy
- positioning

Chatbot Generator:
- customer questions
- qualification flow
- support requirements

Automation Builder:
- repetitive workflows
- integrations
- operational bottlenecks

Execution Engine:
- required agents
- processes
- deployment opportunities

Return ONLY valid JSON matching this exact schema:
{
  "industry": "SaaS|E-commerce|Healthcare|Cybersecurity|Education|Marketplace|Agency|Fintech|Creator Economy",
  "metrics": {
    "marketDifficulty": 1-10,
    "automationPotential": 1-100,
    "revenueScalability": 1-10,
    "operationalComplexity": 1-10,
    "aiAdoptionOpportunity": 1-100
  },
  "businessSnapshot": "One sentence: specific business model, pricing structure, and primary revenue mechanism with realistic ARR potential",
  "targetMarket": "One sentence: precise ICP with company size, job title, industry vertical, and specific pain point driving purchase",
  "strategicInsights": {
    "growthBottleneck": "Specific constraint with root cause — e.g. 'Long sales cycles (90+ days) driven by multi-stakeholder procurement'",
    "fastestChannel": "Named channel with specific tactic — e.g. 'LinkedIn outbound to VP Ops at 200-2000 person SaaS: 18% reply rate via case study hooks'",
    "highestLeverageAutomation": "Named tool + specific workflow — e.g. 'Clay + Apollo: auto-enrich leads, trigger personalized Outreach sequences on intent signals'",
    "operationalRisk": "Specific vulnerability with probability — e.g. 'Key-person dependency: 70% of revenue from top 3 accounts managed by 1 AE'"
  },
  "competitiveAdvantage": {
    "differentiation": "Specific, measurable differentiator vs named competitors — e.g. '40% faster onboarding than Salesforce with no-code config vs Hubspot's 3-week setup'",
    "defensibility": "Named moat type with specific mechanism — e.g. 'Data network effect: proprietary benchmark dataset grows with each customer; 18-month head start'",
    "scalabilityEdge": "Specific leverage point — e.g. 'Usage-based pricing captures value proportional to customer growth; no renegotiation ceiling'"
  },
  "growthPlan": [
    "Phase 1 (0-3mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 2 (3-6mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 3 (6-12mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 4 (12-18mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 5 (18-24mo): [Specific action] via [Named channel/tool] → [Specific metric target]"
  ],
  "websitePages": [
    "Homepage → [specific conversion goal with CTA]",
    "Product/Features → [specific demo or trial trigger]",
    "Pricing → [specific model: per-seat/usage/tier with anchoring]",
    "Case Studies → [specific ROI proof point for ICP]",
    "Blog/SEO → [specific keyword cluster and content angle]"
  ],
  "chatbotRole": "Specific function (e.g. 'Qualify inbound leads using BANT framework') + named integration (e.g. 'Intercom → HubSpot CRM sync') + escalation rule",
  "automations": [
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]"
  ],
  "recommendedStack": {
    "frontend": ["Named framework", "Named UI lib", "Named hosting platform"],
    "backend": ["Named runtime", "Named database", "Named auth provider"],
    "automation": ["Named tool 1", "Named tool 2", "Named tool 3"],
    "crm": "Named CRM with specific reason",
    "payments": "Named payment platform with specific reason"
  },
  "confidence": {
    "overall": "HIGH|MEDIUM|LOW",
    "reason": "explain why"
  },
  "criticalUnknowns": [
    "unknown business assumptions requiring validation"
  ],
  "decisionPriorities": [
    "highest leverage business decisions"
  ],
  "moduleContext": {
    "website": {
      "positioning": "",
      "conversionGoal": ""
    },
    "chatbot": {
      "primaryRole": "",
      "requiredCapabilities": ""
    },
    "automation": {
      "highestValueWorkflow": "",
      "recommendedIntegrations": []
    },
    "execution": {
      "recommendedAgents": [],
      "prioritySequence": []
    }
  },
  "evidence": {
    "facts": [],
    "inferences": [],
    "hypotheses": [],
    "unknowns": []
  }
}

HARD RULES:
- Every field must contain specific, named tools/metrics/companies — NEVER generic advice
- growthPlan must include timeframes and specific numeric targets
- automations must name the exact tool and quantify the benefit
- competitiveAdvantage must reference real named competitors
- NO filler phrases, NO motivational language, NO vague adjectives
- confidence.overall must be exactly HIGH, MEDIUM, or LOW
- criticalUnknowns and decisionPriorities must be arrays of strings
- moduleContext must contain all four sub-objects with string/array values
- evidence must contain all four arrays (facts, inferences, hypotheses, unknowns)`;

// ─── Free Tier System Prompt (shorter, simpler output) ─────────────────────────
const freeSystemPrompt = `You are STAGEONE, an AI business analysis assistant. Analyze the business idea and return a concise structured overview.

Return ONLY valid JSON matching this exact schema (keep text fields brief — 1 sentence max per field):
{
  "industry": "SaaS|E-commerce|Healthcare|Cybersecurity|Education|Marketplace|Agency|Fintech|Creator Economy",
  "metrics": {
    "marketDifficulty": 1-10,
    "automationPotential": 1-100,
    "revenueScalability": 1-10,
    "operationalComplexity": 1-10,
    "aiAdoptionOpportunity": 1-100
  },
  "businessSnapshot": "One sentence: business model and revenue approach",
  "targetMarket": "One sentence: primary customer segment and main pain point",
  "strategicInsights": {
    "growthBottleneck": "Main growth constraint",
    "fastestChannel": "Best acquisition channel",
    "highestLeverageAutomation": "Key automation opportunity",
    "operationalRisk": "Primary business risk"
  },
  "competitiveAdvantage": {
    "differentiation": "Key differentiator vs competitors",
    "defensibility": "Why customers stay",
    "scalabilityEdge": "How the business scales"
  },
  "growthPlan": [
    "Phase 1 (0-3mo): Core action and goal",
    "Phase 2 (3-6mo): Expansion and goal",
    "Phase 3 (6-12mo): Scale and goal"
  ],
  "websitePages": [
    "Homepage → primary CTA",
    "Product/Features → demo trigger",
    "Pricing → tier structure"
  ],
  "chatbotRole": "Customer support and lead capture chatbot",
  "automations": [
    "Lead capture → email sequence",
    "New signup → onboarding flow"
  ],
  "recommendedStack": {
    "frontend": ["React", "Tailwind CSS", "Vercel"],
    "backend": ["Node.js", "PostgreSQL"],
    "automation": ["Zapier", "HubSpot"],
    "crm": "HubSpot",
    "payments": "Stripe"
  },
  "confidence": {
    "overall": "HIGH|MEDIUM|LOW",
    "reason": "explain why"
  },
  "criticalUnknowns": [
    "unknown business assumptions requiring validation"
  ]
}`;

router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { idea, language, projectId } = req.body;
    const userId = req.user!.userId;
    const isAdmin = req.user!.isAdmin ?? false;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      res.status(400).json({ error: "Business idea is required" });
      return;
    }

    if (!process.env.NVIDIA_API_KEY) {
      res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
      return;
    }

    let userPlan = "pro"; // default for admins
    if (!isAdmin) {
      const { getOrCreateSubscription } = await import("./subscriptions");
      const sub = await getOrCreateSubscription(userId);
      userPlan = sub.plan;
      if (sub.aiGenerationsUsed >= sub.aiGenerationsLimit) {
        res.status(429).json({
          error: `AI generation limit reached (${sub.aiGenerationsUsed}/${sub.aiGenerationsLimit}). Upgrade your plan to continue.`,
          plan: sub.plan,
          used: sub.aiGenerationsUsed,
          limit: sub.aiGenerationsLimit,
        });
        return;
      }
      await db.update(subscriptionsTable).set({ aiGenerationsUsed: sub.aiGenerationsUsed + 1 }).where(eq(subscriptionsTable.userId, userId));
    }

    const isFree = userPlan === "free";
    const isStartup = userPlan === "startup" || userPlan === "enterprise";
    const maxTokens = isFree ? 1800 : isStartup ? 5000 : 3500;

    // Set SSE headers early so we can stream reasoning events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Emit initial reasoning state
    res.write(`data: ${JSON.stringify({ reasoning: "Initializing industry profiler...", phase: "init" })}\n\n`);

    const langInstruction = getLanguageInstruction(language);

    // Free users get simplified analysis — skip cross-system context overhead
    let systemPrompt: string;
    if (isFree) {
      systemPrompt = freeSystemPrompt + langInstruction;
      res.write(`data: ${JSON.stringify({ reasoning: "Analyzing business model...", phase: "analysis" })}\n\n`);
    } else {
      // Fetch cross-system context (memories + recent projects) for paid tiers
      const crossSystemContext = await buildCrossSystemContext(userId);
      
      // Fetch BI memory context (historical patterns + learnings)
      const biMemoryContext = await getBiMemoryContext({ userId });
      res.write(`data: ${JSON.stringify({ reasoning: "Loading intelligence memory, cross-system context & historical patterns...", phase: "memory" })}\n\n`);
      
      // Build BI memory context string for prompt injection
      let biMemoryPrompt = "";
      if (biMemoryContext.patterns.length > 0) {
        biMemoryPrompt = `\n\nHISTORICAL INTELLIGENCE PATTERNS (from ${biMemoryContext.totalAnalyses} prior analyses):\n`;
        
        for (const pattern of biMemoryContext.patterns.slice(0, 3)) {
          biMemoryPrompt += `\n--- ${pattern.industry} (${pattern.count} analyses, avg quality: ${pattern.avgQualityScore}%) ---\n`;
          if (pattern.commonBottlenecks.length > 0) {
            biMemoryPrompt += `Common bottlenecks: ${pattern.commonBottlenecks.join(", ")}\n`;
          }
          if (pattern.commonChannels.length > 0) {
            biMemoryPrompt += `Effective channels: ${pattern.commonChannels.join(", ")}\n`;
          }
          if (pattern.commonAutomations.length > 0) {
            biMemoryPrompt += `High-leverage automations: ${pattern.commonAutomations.join(", ")}\n`;
          }
          if (pattern.commonRisks.length > 0) {
            biMemoryPrompt += `Recurring risks: ${pattern.commonRisks.join(", ")}\n`;
          }
        }
        biMemoryPrompt += `\nUse these patterns as historical evidence. Never treat as facts for the current idea.\n`;
      }
      
      if (biMemoryContext.similarProjects.length > 0) {
        biMemoryPrompt += `\nRECENT HIGH-QUALITY ANALYSES:\n`;
        for (const memory of biMemoryContext.similarProjects.slice(0, 2)) {
          biMemoryPrompt += `- ${memory.industry}: ${memory.businessModel?.slice(0, 100)}... (quality: ${memory.qualityScore}%)\n`;
        }
      }
      
      systemPrompt = baseSystemPrompt + crossSystemContext + biMemoryPrompt + langInstruction;
    }

    let streamBody: ReadableStream<Uint8Array>;
    try {
      const userMessage = isFree
        ? `Analyze this business idea and return a concise structured overview: "${idea}"`
        : `Apply deep cross-system intelligence to analyze this business idea. Consider how every output (website, automations, agents, monetization) interconnects: "${idea}"`;

      streamBody = await streamNvidia({
        model: MODELS.BUSINESS_INTELLIGENCE,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        maxTokens,
        nvextParams: { thinking: { enabled: false } },
      });
    } catch (streamErr) {
      req.log.error({ streamErr, model: MODELS.BUSINESS_INTELLIGENCE }, `[AI:${MODELS.BUSINESS_INTELLIGENCE}] Failed to open stream`);
      res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    const reader = streamBody.getReader();

    let contentBuffer = "";
    let lineCarryover = "";
    let industryDetected = false;
    let detectedIndustry = "default";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = lineCarryover + decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        lineCarryover = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              contentBuffer += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);

              if (!industryDetected && contentBuffer.length > 30) {
                const industryMatch = /"industry"\s*:\s*"([^"]+)"/.exec(contentBuffer);
                if (industryMatch) {
                  detectedIndustry = industryMatch[1];
                  industryDetected = true;
                  const reasoning = INDUSTRY_REASONING[detectedIndustry] ?? INDUSTRY_REASONING.default;
                  res.write(`data: ${JSON.stringify({ reasoningStages: reasoning, industry: detectedIndustry, phase: "industry_detected" })}\n\n`);
                }
              }
            }
          } catch {
            // Incomplete JSON fragment — skip
          }
        }
      }

      if (lineCarryover.startsWith("data: ")) {
        const data = lineCarryover.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) contentBuffer += content;
          } catch { /* ignore */ }
        }
      }

      try {
        const rawData = extractJson(contentBuffer) as Record<string, unknown>;

        // Validate and repair the output
        let validatedData = validateAndRepairBI(rawData, idea);

        // Detect false intelligence (hallucinations)
        validatedData = detectFalseIntelligence(validatedData, idea);

        // Recalculate confidence based on actual output quality
        validatedData.confidence = calculateConfidence(idea, validatedData);

        // Calculate quality score
        validatedData.qualityScore = calculateQualityScore(validatedData, idea);

        // Add validation metadata
        validatedData = addValidationMetadata(validatedData, idea);

        // Repair pass for missing important fields
        const importantFields = ["moduleContext", "decisionPriorities", "evidence", "criticalUnknowns"];
        const missingImportant = importantFields.filter(f => {
          const val = validatedData[f as keyof typeof validatedData];
          if (Array.isArray(val)) return val.length === 0 || val.every(v => v.startsWith("UNKNOWN"));
          if (typeof val === "object" && val !== null) return Object.values(val).every(v => typeof v === "string" && v.startsWith("UNKNOWN"));
          return false;
        });

        if (missingImportant.length > 0) {
          // Run repair prompt
          const repaired = await repairBIOutput(missingImportant, validatedData, idea);
          validatedData = { ...validatedData, ...repaired };
        }

        res.write(`data: ${JSON.stringify({ done: true, data: validatedData })}\n\n`);

        logEventFireForget({ userId, projectId: projectId as string | undefined, type: "bi_generated", data: { industry: detectedIndustry }, req });
        trackUsageFireForget(userId, "biGenerations");

        // V5: Update Business Graph Memory (fire-and-forget — never blocks the stream)
        onBusinessIntelligenceComplete(
          projectId as string | undefined,
          userId,
          idea,
          validatedData as unknown as Record<string, unknown>,
        ).catch(() => {});

        // Store BI learnings for future generations (fire-and-forget)
        storeBiMemory({
          userId,
          projectId: projectId as string | undefined,
          biOutput: validatedData,
          idea,
        }).catch(() => {});
      } catch (parseErr) {
        req.log.error({ parseErr, contentBuffer: contentBuffer.slice(0, 200) }, "Final JSON parse failed");
        res.write(`data: ${JSON.stringify({ error: "Failed to parse AI response — please try again" })}\n\n`);
      }

      res.end();
    } catch (streamErr) {
      req.log.error({ streamErr }, "Stream read error");
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted — please try again" })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    req.log.error({ error }, "Generate API error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
      res.end();
    }
  }
});

router.post("/generate/feedback", requireAuth, async (req, res): Promise<void> => {
  try {
    const { projectId, insightId, feedback, notes } = req.body;
    const userId = req.user!.userId;

    if (!projectId || !insightId || !feedback) {
      res.status(400).json({ error: "projectId, insightId, and feedback are required" });
      return;
    }

    const { storeBiFeedback } = await import("../../../../lib/db/src/bi-memory");
    await storeBiFeedback(userId, projectId, insightId, feedback, notes);

    res.json({ success: true });
  } catch (error) {
    req.log.error({ error }, "Feedback storage failed");
    res.status(500).json({ error: "Failed to store feedback" });
  }
});

export default router;