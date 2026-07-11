import { describe, it, expect } from "vitest";

// Test utilities matching the implementation in generate.ts
const REQUIRED_INDUSTRIES = [
  "SaaS", "E-commerce", "Healthcare", "Cybersecurity", "Education",
  "Marketplace", "Agency", "Fintech", "Creator Economy"
] as const;

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
}

// Fixed validation logic matching generate.ts
function validateAndRepairBI(raw: unknown, userIdea: string): BIValidatedOutput {
  const data = raw as Record<string, unknown>;

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
    return (current === null || current === undefined) ? fallback : (current as T);
  };

  const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

  const industry = get(data, "industry", "SaaS");
  const validIndustry = REQUIRED_INDUSTRIES.includes(industry as typeof REQUIRED_INDUSTRIES[number])
    ? industry
    : "SaaS";

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

  const businessSnapshot = get(data, "businessSnapshot", "UNKNOWN — insufficient information to generate business snapshot");
  const targetMarket = get(data, "targetMarket", "UNKNOWN — target market not specified");

  const strategicInsights = {
    growthBottleneck: get(data, "strategicInsights.growthBottleneck", "UNKNOWN — growth bottleneck not identified"),
    fastestChannel: get(data, "strategicInsights.fastestChannel", "UNKNOWN — fastest channel not identified"),
    highestLeverageAutomation: get(data, "strategicInsights.highestLeverageAutomation", "UNKNOWN — automation opportunity not identified"),
    operationalRisk: get(data, "strategicInsights.operationalRisk", "UNKNOWN — operational risk not identified"),
  };

  const competitiveAdvantage = {
    differentiation: get(data, "competitiveAdvantage.differentiation", "UNKNOWN — differentiation not specified"),
    defensibility: get(data, "competitiveAdvantage.defensibility", "UNKNOWN — defensibility not specified"),
    scalabilityEdge: get(data, "competitiveAdvantage.scalabilityEdge", "UNKNOWN — scalability edge not specified"),
  };

  const growthPlan = Array.isArray(data.growthPlan)
    ? data.growthPlan.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — growth plan not generated"];

  const websitePages = Array.isArray(data.websitePages)
    ? data.websitePages.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — website pages not generated"];

  const chatbotRole = get(data, "chatbotRole", "UNKNOWN — chatbot role not specified");

  const automations = Array.isArray(data.automations)
    ? data.automations.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — automations not generated"];

  const recommendedStack = {
    frontend: Array.isArray(get(data, "recommendedStack.frontend", [])) ? get(data, "recommendedStack.frontend", []) : ["React", "Tailwind CSS", "Vercel"],
    backend: Array.isArray(get(data, "recommendedStack.backend", [])) ? get(data, "recommendedStack.backend", []) : ["Node.js", "PostgreSQL"],
    automation: Array.isArray(get(data, "recommendedStack.automation", [])) ? get(data, "recommendedStack.automation", []) : ["Zapier", "HubSpot"],
    crm: get(data, "recommendedStack.crm", "HubSpot"),
    payments: get(data, "recommendedStack.payments", "Stripe"),
  };

  const confidenceRaw = get(data, "confidence", { overall: "LOW", reason: "Model did not provide confidence assessment" }) as Record<string, unknown>;
  const confidence: BIConfidence = {
    overall: (confidenceRaw.overall === "HIGH" || confidenceRaw.overall === "MEDIUM" || confidenceRaw.overall === "LOW")
      ? confidenceRaw.overall
      : "LOW",
    reason: typeof confidenceRaw.reason === "string" && confidenceRaw.reason.length > 0
      ? confidenceRaw.reason
      : "Model did not provide confidence assessment",
  };

  const criticalUnknowns = Array.isArray(data.criticalUnknowns)
    ? data.criticalUnknowns.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — critical unknowns not identified"];

  const decisionPriorities = Array.isArray(data.decisionPriorities)
    ? data.decisionPriorities.filter((x): x is string => typeof x === "string" && x.length > 0)
    : ["UNKNOWN — decision priorities not identified"];

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

  const evidenceRaw = get(data, "evidence", {}) as Record<string, unknown>;
  const evidence: BIEvidence = {
    facts: Array.isArray(evidenceRaw.facts) ? evidenceRaw.facts.filter((x): x is string => typeof x === "string") : [],
    inferences: Array.isArray(evidenceRaw.inferences) ? evidenceRaw.inferences.filter((x): x is string => typeof x === "string") : [],
    hypotheses: Array.isArray(evidenceRaw.hypotheses) ? evidenceRaw.hypotheses.filter((x): x is string => typeof x === "string") : [],
    unknowns: Array.isArray(evidenceRaw.unknowns) ? evidenceRaw.unknowns.filter((x): x is string => typeof x === "string") : [],
  };

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
  };
}

function detectFalseIntelligence(output: BIValidatedOutput, userIdea: string): BIValidatedOutput {
  const suspiciousPatterns = [
    { pattern: /\$\d+[KM]?\s*(ARR|MRR|revenue)/i, field: "businessSnapshot", type: "revenue" },
    { pattern: /\d+%\s*(conversion|churn|retention|growth)/i, field: "metrics", type: "metric" },
    { pattern: /\d+\s*(customers?|users?|clinics?|companies?)/i, field: "targetMarket", type: "customer_count" },
    { pattern: /(Salesforce|HubSpot|Stripe|Shopify|Atlassian|Microsoft|Google|Amazon|Oracle|SAP)\s+(is|has|uses|offers)/i, field: "competitiveAdvantage", type: "competitor_claim" },
    { pattern: /(Clay|Apollo|Outreach|Segment|PostHog|Retool|Zapier|Make|n8n)\s+(integration|automates|connects)/i, field: "automations", type: "tool_claim" },
  ];

  const hypotheses: string[] = [];
  const unknowns: string[] = [];

  suspiciousPatterns.forEach(({ pattern, field, type }) => {
    const value = JSON.stringify(output[field as keyof BIValidatedOutput]);
    if (pattern.test(value)) {
      hypotheses.push(`Hypothesis: ${field} contains unverified ${type} claim — requires validation`);
      unknowns.push(`Validation needed: ${field} ${type} claim`);
    }
  });

  output.evidence.hypotheses = [...new Set([...output.evidence.hypotheses, ...hypotheses])];
  output.evidence.unknowns = [...new Set([...output.evidence.unknowns, ...unknowns])];

  if (output.confidence.overall === "HIGH" && (hypotheses.length > 0 || unknowns.length > 0)) {
    output.confidence.overall = "MEDIUM";
    output.confidence.reason = "Downgraded due to unverified claims detected";
  }

  return output;
}

function calculateConfidence(userIdea: string, output: BIValidatedOutput): BIConfidence {
  let score = 0;
  const reasons: string[] = [];

  const ideaWords = userIdea.trim().split(/\s+/).length;
  if (ideaWords > 50) { score += 35; reasons.push("detailed input"); }
  else if (ideaWords > 20) { score += 25; reasons.push("moderate input"); }
  else if (ideaWords > 10) { score += 15; reasons.push("basic input"); }
  else if (ideaWords > 5) { score += 10; reasons.push("short input"); }
  else { reasons.push("minimal input"); }

  if (output.industry !== "SaaS" || userIdea.toLowerCase().includes("saas")) {
    score += 15; reasons.push("clear industry");
  }

  const unknownCount = [
    output.businessSnapshot,
    output.targetMarket,
    output.strategicInsights.growthBottleneck,
    output.strategicInsights.fastestChannel,
    output.strategicInsights.highestLeverageAutomation,
    output.strategicInsights.operationalRisk,
  ].filter(v => v.startsWith("UNKNOWN")).length;

  if (unknownCount === 0) { score += 30; reasons.push("complete output"); }
  else if (unknownCount <= 2) { score += 20; reasons.push("mostly complete"); }
  else { reasons.push(`${unknownCount} unknown fields`); }

  if (output.evidence.facts.length > 0) { score += 10; reasons.push("has facts"); }
  if (output.evidence.inferences.length > 0) { score += 5; reasons.push("has inferences"); }

  let overall: "HIGH" | "MEDIUM" | "LOW";
  if (score >= 60) overall = "HIGH";
  else if (score >= 30) overall = "MEDIUM";
  else overall = "LOW";

  return {
    overall,
    reason: reasons.length > 0 ? reasons.join("; ") : "Insufficient information for assessment",
  };
}

describe("BI Validation Pipeline", () => {
  describe("validateAndRepairBI", () => {
    it("should return valid output for complete input", () => {
      const input = {
        industry: "Healthcare",
        metrics: { marketDifficulty: 6, automationPotential: 90, revenueScalability: 8, operationalComplexity: 7, aiAdoptionOpportunity: 95 },
        businessSnapshot: "AI scheduling for clinics",
        targetMarket: "Mid-size clinics",
        strategicInsights: { growthBottleneck: "EMR integration", fastestChannel: "EMR partnerships", highestLeverageAutomation: "Reminders", operationalRisk: "HIPAA" },
        competitiveAdvantage: { differentiation: "Deep EMR integration", defensibility: "Custom workflows", scalabilityEdge: "Cloud-based" },
        growthPlan: ["Phase 1: Pilot", "Phase 2: Scale"],
        websitePages: ["Homepage → Demo", "Features → EMR showcase"],
        chatbotRole: "Schedule demos",
        automations: ["Lead → Email nurture"],
        recommendedStack: { frontend: ["React"], backend: ["Node.js"], automation: ["Zapier"], crm: "Salesforce Health Cloud", payments: "Stripe" },
        confidence: { overall: "HIGH", reason: "Complete data" },
        criticalUnknowns: ["EMR integration timeline"],
        decisionPriorities: ["Validate EMR partnerships"],
        moduleContext: { website: { positioning: "AI scheduling", conversionGoal: "Demo" }, chatbot: { primaryRole: "Demo booking", requiredCapabilities: "Calendar" }, automation: { highestValueWorkflow: "Reminders", recommendedIntegrations: ["EMR"] }, execution: { recommendedAgents: ["Scheduler"], prioritySequence: ["Pilot"] } },
        evidence: { facts: ["User input: AI scheduling"], inferences: [], hypotheses: [], unknowns: [] }
      };

      const result = validateAndRepairBI(input, "AI scheduling for healthcare clinics");

      expect(result.industry).toBe("Healthcare");
      expect(result.metrics.marketDifficulty).toBe(6);
      expect(result.confidence.overall).toBe("HIGH");
      expect(result.moduleContext.website.positioning).toBe("AI scheduling");
      expect(result.evidence.facts).toContain("User input: AI scheduling");
    });

    it("should repair missing fields with UNKNOWN defaults", () => {
      const input = {};

      const result = validateAndRepairBI(input, "AI thing");

      expect(result.industry).toBe("SaaS");
      expect(result.businessSnapshot).toContain("UNKNOWN");
      expect(result.targetMarket).toContain("UNKNOWN");
      expect(result.strategicInsights.growthBottleneck).toContain("UNKNOWN");
      expect(result.confidence.overall).toBe("LOW");
      expect(result.criticalUnknowns).toContain("UNKNOWN — critical unknowns not identified");
      expect(result.moduleContext.website.positioning).toContain("UNKNOWN");
      expect(result.evidence.unknowns.length).toBeGreaterThan(0);
    });

    it("should clamp metrics to valid ranges", () => {
      const input = {
        metrics: { marketDifficulty: 15, automationPotential: 150, revenueScalability: -1, operationalComplexity: 0, aiAdoptionOpportunity: 200 }
      };

      const result = validateAndRepairBI(input, "test");

      expect(result.metrics.marketDifficulty).toBe(10);
      expect(result.metrics.automationPotential).toBe(100);
      expect(result.metrics.revenueScalability).toBe(1);
      expect(result.metrics.operationalComplexity).toBe(1); // 0 clamped to 1
      expect(result.metrics.aiAdoptionOpportunity).toBe(100);
    });

    it("should normalize invalid industry to SaaS", () => {
      const input = { industry: "InvalidIndustry" };
      const result = validateAndRepairBI(input, "test");
      expect(result.industry).toBe("SaaS");
    });

    it("should filter empty arrays and strings", () => {
      const input = {
        growthPlan: ["", "Phase 1", null, "Phase 2"],
        websitePages: ["", "Homepage"],
        automations: ["", "Lead → Email"],
        criticalUnknowns: ["", "Unknown 1"],
        decisionPriorities: ["", "Priority 1"],
      };

      const result = validateAndRepairBI(input, "test");

      expect(result.growthPlan).toEqual(["Phase 1", "Phase 2"]);
      expect(result.websitePages).toEqual(["Homepage"]);
      expect(result.automations).toEqual(["Lead → Email"]);
      expect(result.criticalUnknowns).toEqual(["Unknown 1"]);
      expect(result.decisionPriorities).toEqual(["Priority 1"]);
    });

    it("should preserve valid confidence values", () => {
      const input = { confidence: { overall: "HIGH", reason: "test" } };
      const result = validateAndRepairBI(input, "test");
      expect(result.confidence.overall).toBe("HIGH");
      expect(result.confidence.reason).toBe("test");
    });

    it("should normalize invalid confidence to LOW", () => {
      const input = { confidence: { overall: "INVALID" } };
      const result = validateAndRepairBI(input, "test");
      expect(result.confidence.overall).toBe("LOW");
    });
  });

  describe("detectFalseIntelligence", () => {
    it("should detect revenue claims and add hypotheses", () => {
      const output = validateAndRepairBI({
        businessSnapshot: "Generates $10M ARR",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "1000 clinics",
        competitiveAdvantage: { differentiation: "Better than Salesforce", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: ["Clay integration automates leads"],
        confidence: { overall: "HIGH", reason: "test" },
      }, "test");

      const result = detectFalseIntelligence(output, "test");

      expect(result.evidence.hypotheses.length).toBeGreaterThan(0);
      expect(result.evidence.unknowns.length).toBeGreaterThan(0);
      expect(result.confidence.overall).toBe("MEDIUM"); // Downgraded from HIGH
    });

    it("should not downgrade MEDIUM confidence", () => {
      const output = validateAndRepairBI({
        businessSnapshot: "Generates $10M ARR",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "1000 clinics",
        competitiveAdvantage: { differentiation: "Better than Salesforce", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: ["Clay integration automates leads"],
        confidence: { overall: "MEDIUM", reason: "test" },
      }, "test");

      const result = detectFalseIntelligence(output, "test");

      expect(result.confidence.overall).toBe("MEDIUM");
    });

    it("should not downgrade LOW confidence", () => {
      const output = validateAndRepairBI({
        businessSnapshot: "Generates $10M ARR",
        confidence: { overall: "LOW", reason: "test" },
      }, "test");

      const result = detectFalseIntelligence(output, "test");

      expect(result.confidence.overall).toBe("LOW");
    });
  });

  describe("calculateConfidence", () => {
    it("should return HIGH for detailed input with complete output", () => {
      const output = validateAndRepairBI({
        industry: "Healthcare",
        metrics: { marketDifficulty: 6, automationPotential: 90, revenueScalability: 8, operationalComplexity: 7, aiAdoptionOpportunity: 95 },
        businessSnapshot: "AI scheduling for clinics",
        targetMarket: "Mid-size clinics",
        strategicInsights: { growthBottleneck: "EMR integration", fastestChannel: "EMR partnerships", highestLeverageAutomation: "Reminders", operationalRisk: "HIPAA" },
        competitiveAdvantage: { differentiation: "Deep EMR integration", defensibility: "Custom workflows", scalabilityEdge: "Cloud-based" },
        growthPlan: ["Phase 1", "Phase 2"],
        websitePages: ["Homepage", "Features"],
        chatbotRole: "Schedule demos",
        automations: ["Lead → Email"],
        recommendedStack: { frontend: ["React"], backend: ["Node.js"], automation: ["Zapier"], crm: "Salesforce", payments: "Stripe" },
        confidence: { overall: "HIGH", reason: "test" },
        criticalUnknowns: [],
        decisionPriorities: [],
        moduleContext: { website: { positioning: "", conversionGoal: "" }, chatbot: { primaryRole: "", requiredCapabilities: "" }, automation: { highestValueWorkflow: "", recommendedIntegrations: [] }, execution: { recommendedAgents: [], prioritySequence: [] } },
        evidence: { facts: ["User input: AI scheduling"], inferences: [], hypotheses: [], unknowns: [] }
      }, "AI scheduling assistant for healthcare clinics that automates appointment booking, reminders, and follow-ups with HIPAA compliance");

      const confidence = calculateConfidence("AI scheduling assistant for healthcare clinics that automates appointment booking, reminders, and follow-ups with HIPAA compliance", output);

      expect(confidence.overall).toBe("HIGH");
    });

    it("should return LOW for minimal input", () => {
      const output = validateAndRepairBI({}, "AI thing");

      const confidence = calculateConfidence("AI thing", output);

      expect(confidence.overall).toBe("LOW");
    });

    it("should return MEDIUM for moderate input", () => {
      const output = validateAndRepairBI({
        businessSnapshot: "AI scheduling",
        targetMarket: "Clinics",
        strategicInsights: { growthBottleneck: "Integration", fastestChannel: "Partnerships", highestLeverageAutomation: "Reminders", operationalRisk: "HIPAA" },
      }, "AI scheduling for clinics");

      const confidence = calculateConfidence("AI scheduling for clinics", output);

      expect(confidence.overall).toBe("MEDIUM");
    });
  });
});

describe("BI Schema Integration", () => {
  it("should produce valid BIValidatedOutput with all required fields", () => {
    const result = validateAndRepairBI({}, "test idea");

    expect(result).toHaveProperty("industry");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("businessSnapshot");
    expect(result).toHaveProperty("targetMarket");
    expect(result).toHaveProperty("strategicInsights");
    expect(result).toHaveProperty("competitiveAdvantage");
    expect(result).toHaveProperty("growthPlan");
    expect(result).toHaveProperty("websitePages");
    expect(result).toHaveProperty("chatbotRole");
    expect(result).toHaveProperty("automations");
    expect(result).toHaveProperty("recommendedStack");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("criticalUnknowns");
    expect(result).toHaveProperty("decisionPriorities");
    expect(result).toHaveProperty("moduleContext");
    expect(result).toHaveProperty("evidence");

    expect(result.metrics).toHaveProperty("marketDifficulty");
    expect(result.metrics).toHaveProperty("automationPotential");
    expect(result.metrics).toHaveProperty("revenueScalability");
    expect(result.metrics).toHaveProperty("operationalComplexity");
    expect(result.metrics).toHaveProperty("aiAdoptionOpportunity");

    expect(result.strategicInsights).toHaveProperty("growthBottleneck");
    expect(result.strategicInsights).toHaveProperty("fastestChannel");
    expect(result.strategicInsights).toHaveProperty("highestLeverageAutomation");
    expect(result.strategicInsights).toHaveProperty("operationalRisk");

    expect(result.competitiveAdvantage).toHaveProperty("differentiation");
    expect(result.competitiveAdvantage).toHaveProperty("defensibility");
    expect(result.competitiveAdvantage).toHaveProperty("scalabilityEdge");

    expect(result.confidence).toHaveProperty("overall");
    expect(result.confidence).toHaveProperty("reason");

    expect(result.moduleContext).toHaveProperty("website");
    expect(result.moduleContext).toHaveProperty("chatbot");
    expect(result.moduleContext).toHaveProperty("automation");
    expect(result.moduleContext).toHaveProperty("execution");

    expect(result.evidence).toHaveProperty("facts");
    expect(result.evidence).toHaveProperty("inferences");
    expect(result.evidence).toHaveProperty("hypotheses");
    expect(result.evidence).toHaveProperty("unknowns");
  });

  it("should have confidence.overall as HIGH|MEDIUM|LOW only", () => {
    const result = validateAndRepairBI({ confidence: { overall: "INVALID" } }, "test");
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(result.confidence.overall);
  });

  it("should have moduleContext with all four sub-objects", () => {
    const result = validateAndRepairBI({}, "test");
    expect(result.moduleContext.website).toHaveProperty("positioning");
    expect(result.moduleContext.website).toHaveProperty("conversionGoal");
    expect(result.moduleContext.chatbot).toHaveProperty("primaryRole");
    expect(result.moduleContext.chatbot).toHaveProperty("requiredCapabilities");
    expect(result.moduleContext.automation).toHaveProperty("highestValueWorkflow");
    expect(result.moduleContext.automation).toHaveProperty("recommendedIntegrations");
    expect(result.moduleContext.execution).toHaveProperty("recommendedAgents");
    expect(result.moduleContext.execution).toHaveProperty("prioritySequence");
  });
});