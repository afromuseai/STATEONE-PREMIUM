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

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

function calculateQualityScore(output: BIValidatedOutput, userIdea: string): BIQualityScore {
  let completeness = 0;
  const totalFields = 20;
  let presentFields = 0;

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

  if (output.growthPlan.length >= 3) presentFields += 2;
  else if (output.growthPlan.length > 0) presentFields += 1;

  const mc = output.moduleContext;
  if (!mc.website.positioning.startsWith("UNKNOWN")) presentFields++;
  if (!mc.website.conversionGoal.startsWith("UNKNOWN")) presentFields++;
  if (!mc.chatbot.primaryRole.startsWith("UNKNOWN")) presentFields++;
  if (!mc.chatbot.requiredCapabilities.startsWith("UNKNOWN")) presentFields++;
  if (!mc.automation.highestValueWorkflow.startsWith("UNKNOWN")) presentFields++;
  if (mc.automation.recommendedIntegrations.length > 0) presentFields++;
  if (mc.execution.recommendedAgents.length > 0) presentFields++;
  if (mc.execution.prioritySequence.length > 0) presentFields++;

  presentFields += 5;

  completeness = Math.round((presentFields / totalFields) * 100);

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

  let actionability = 0;
  let actionScore = 0;
  const hasTimeframes = output.growthPlan.some(p => /Phase \d|\(0-|\(3-|\(6-|\(12-|\(18-/.test(p));
  if (hasTimeframes) actionScore += 30;
  const namedTools = output.automations.filter(a => /(Zapier|HubSpot|Salesforce|Stripe|Slack|Notion|Airtable|Make|n8n|Clay|Apollo|Outreach|Segment|PostHog|Retool)/i.test(a)).length;
  if (namedTools >= 2) actionScore += 30;
  else if (namedTools >= 1) actionScore += 15;
  const measurableTargets = output.growthPlan.filter(p => /\d+%|\$\d+|\d+x|\d+ (customers?|users?|clinics?)/i.test(p)).length;
  if (measurableTargets >= 2) actionScore += 25;
  else if (measurableTargets >= 1) actionScore += 15;
  if (!output.moduleContext.automation.highestValueWorkflow.startsWith("UNKNOWN")) actionScore += 15;
  if (!output.moduleContext.website.conversionGoal.startsWith("UNKNOWN")) actionScore += 10;

  actionability = Math.min(100, actionScore);

  const overall = Math.round(completeness * 0.4 + evidenceStrength * 0.3 + actionability * 0.3);

  return {
    overall,
    completeness,
    evidenceStrength,
    actionability,
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

  const authorityKeywords = ["YC", "Y Combinator", "McKinsey", "a16z", "Andreessen Horowitz", "Harvard", "Gartner", "Forrester", "IDC"];
  const fullText = JSON.stringify(output);
  authorityKeywords.forEach(auth => {
    const regex = new RegExp(`\\b${auth}\\b`, "i");
    if (regex.test(fullText)) {
      const sourcedRegex = new RegExp(`(according to|cited by|reported by|study by|survey by|data from)\\s+.*\\b${auth}\\b`, "i");
      if (!sourcedRegex.test(fullText)) {
        hypotheses.push(`Hypothesis: Unverified authority claim — "${auth}" mentioned without explicit source`);
        unknowns.push(`Validation needed: Authority claim for ${auth}`);
      }
    }
  });

  const partnershipPatterns = [
    /partner(?:ship|ed)?\s+with\s+(Stripe|Shopify|Salesforce|HubSpot|AWS|Google Cloud|Azure|Vercel|Netlify)/i,
    /(Stripe|Shopify|Salesforce|HubSpot|AWS|Google Cloud|Azure|Vercel|Netlify)\s+partner/i,
    /official\s+partner\s+of\s+(Stripe|Shopify|Salesforce|HubSpot|AWS|Google Cloud|Azure|Vercel|Netlify)/i,
  ];
  partnershipPatterns.forEach(pattern => {
    if (pattern.test(fullText)) {
      hypotheses.push(`Hypothesis: Unverified partnership claim detected — requires validation`);
      unknowns.push(`Validation needed: Partnership claim`);
    }
  });

  const validationPatterns = [
    /customers?\s+(want|need|demand|love)\s+this/i,
    /market\s+(wants|needs|demands)\s+this/i,
    /validated\s+by\s+customers?/i,
    /proven\s+demand/i,
    /customers?\s+will\s+pay/i,
  ];
  validationPatterns.forEach(pattern => {
    if (pattern.test(fullText)) {
      hypotheses.push(`Hypothesis: Unverified customer validation claim — "customers want this" requires evidence`);
      unknowns.push(`Validation needed: Customer demand claim`);
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

function addValidationMetadata(output: BIValidatedOutput, userIdea: string): BIValidatedOutput {
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

describe("BI Quality Layer", () => {
  describe("calculateQualityScore", () => {
    it("should return HIGH quality for complete output with facts and actionability", () => {
      const output = {
        industry: "Healthcare",
        metrics: { marketDifficulty: 6, automationPotential: 90, revenueScalability: 8, operationalComplexity: 7, aiAdoptionOpportunity: 95 },
        businessSnapshot: "AI scheduling for clinics",
        targetMarket: "Mid-size clinics",
        strategicInsights: { growthBottleneck: "EMR integration", fastestChannel: "EMR partnerships", highestLeverageAutomation: "Reminders", operationalRisk: "HIPAA" },
        competitiveAdvantage: { differentiation: "Deep EMR integration", defensibility: "Custom workflows", scalabilityEdge: "Cloud-based" },
        growthPlan: ["Phase 1 (0-3mo): Pilot 5 clinics", "Phase 2 (3-6mo): Scale to 50", "Phase 3 (6-12mo): 200 clinics"],
        websitePages: ["Homepage", "Features", "Pricing"],
        chatbotRole: "Schedule demos",
        automations: ["Lead → Email nurture", "New signup → Onboarding"],
        recommendedStack: { frontend: ["React"], backend: ["Node.js"], automation: ["Zapier"], crm: "Salesforce", payments: "Stripe" },
        confidence: { overall: "HIGH", reason: "test" },
        criticalUnknowns: [],
        decisionPriorities: [],
        moduleContext: { website: { positioning: "AI scheduling", conversionGoal: "Demo" }, chatbot: { primaryRole: "Demo booking", requiredCapabilities: "Calendar" }, automation: { highestValueWorkflow: "Reminders", recommendedIntegrations: ["EMR"] }, execution: { recommendedAgents: ["Scheduler"], prioritySequence: ["Pilot"] } },
        evidence: { facts: ["User input: AI scheduling"], inferences: [], hypotheses: [], unknowns: [] },
        qualityScore: { overall: 0, completeness: 0, evidenceStrength: 0, actionability: 0 },
        validation: { validatedAt: "", validationLevel: "IDEA", requiresHumanValidation: [] },
      } as BIValidatedOutput;

      const score = calculateQualityScore(output, "AI scheduling for healthcare clinics");

      expect(score.overall).toBeGreaterThanOrEqual(70);
      expect(score.completeness).toBeGreaterThanOrEqual(80);
      expect(score.evidenceStrength).toBeGreaterThanOrEqual(70);
      expect(score.actionability).toBeGreaterThanOrEqual(70);
    });

    it("should return LOW quality for minimal output", () => {
      const output = {
        industry: "SaaS",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        businessSnapshot: "UNKNOWN — insufficient information",
        targetMarket: "UNKNOWN — target market not specified",
        strategicInsights: { growthBottleneck: "UNKNOWN", fastestChannel: "UNKNOWN", highestLeverageAutomation: "UNKNOWN", operationalRisk: "UNKNOWN" },
        competitiveAdvantage: { differentiation: "UNKNOWN", defensibility: "UNKNOWN", scalabilityEdge: "UNKNOWN" },
        growthPlan: ["UNKNOWN — growth plan not generated"],
        websitePages: ["UNKNOWN — website pages not generated"],
        chatbotRole: "UNKNOWN — chatbot role not specified",
        automations: ["UNKNOWN — automations not generated"],
        recommendedStack: { frontend: ["React"], backend: ["Node.js"], automation: ["Zapier"], crm: "HubSpot", payments: "Stripe" },
        confidence: { overall: "LOW", reason: "test" },
        criticalUnknowns: ["UNKNOWN — critical unknowns not identified"],
        decisionPriorities: ["UNKNOWN — decision priorities not identified"],
        moduleContext: { website: { positioning: "UNKNOWN", conversionGoal: "UNKNOWN" }, chatbot: { primaryRole: "UNKNOWN", requiredCapabilities: "UNKNOWN" }, automation: { highestValueWorkflow: "UNKNOWN", recommendedIntegrations: [] }, execution: { recommendedAgents: [], prioritySequence: [] } },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
        qualityScore: { overall: 0, completeness: 0, evidenceStrength: 0, actionability: 0 },
        validation: { validatedAt: "", validationLevel: "IDEA", requiresHumanValidation: [] },
      } as BIValidatedOutput;

      const score = calculateQualityScore(output, "AI thing");

      expect(score.overall).toBeLessThan(50);
      expect(score.completeness).toBeLessThan(50);
      expect(score.evidenceStrength).toBeLessThan(50);
      expect(score.actionability).toBeLessThan(50);
    });

    it("should return MEDIUM quality for moderate output", () => {
      const output = {
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
        confidence: { overall: "MEDIUM", reason: "test" },
        criticalUnknowns: [],
        decisionPriorities: [],
        moduleContext: { website: { positioning: "AI scheduling", conversionGoal: "Demo" }, chatbot: { primaryRole: "Demo booking", requiredCapabilities: "Calendar" }, automation: { highestValueWorkflow: "Reminders", recommendedIntegrations: ["EMR"] }, execution: { recommendedAgents: ["Scheduler"], prioritySequence: ["Pilot"] } },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
        qualityScore: { overall: 0, completeness: 0, evidenceStrength: 0, actionability: 0 },
        validation: { validatedAt: "", validationLevel: "IDEA", requiresHumanValidation: [] },
      } as BIValidatedOutput;

      const score = calculateQualityScore(output, "AI scheduling for clinics");

      expect(score.overall).toBeGreaterThanOrEqual(50);
      expect(score.overall).toBeLessThanOrEqual(75);
    });
  });

  describe("detectFalseIntelligence", () => {
    it("should detect fake authority claims", () => {
      const output = {
        businessSnapshot: "YC recommends this approach for healthcare startups",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "Clinics",
        competitiveAdvantage: { differentiation: "Better than McKinsey", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: ["Clay integration automates leads"],
        confidence: { overall: "HIGH", reason: "test" },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
      } as BIValidatedOutput;

      const result = detectFalseIntelligence(output, "test");

      expect(result.evidence.hypotheses.length).toBeGreaterThan(0);
      expect(result.evidence.unknowns.length).toBeGreaterThan(0);
      expect(result.confidence.overall).toBe("MEDIUM");
    });

    it("should detect fake partnership claims", () => {
      const output = {
        businessSnapshot: "Partner with Stripe for payments",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "Clinics",
        competitiveAdvantage: { differentiation: "Better", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: ["Stripe partnership guarantees growth"],
        confidence: { overall: "HIGH", reason: "test" },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
      } as BIValidatedOutput;

      const result = detectFalseIntelligence(output, "test");

      expect(result.evidence.hypotheses.some(h => h.includes("partnership"))).toBe(true);
      expect(result.confidence.overall).toBe("MEDIUM");
    });

    it("should detect fake validation claims", () => {
      const output = {
        businessSnapshot: "Customers want this solution",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "Clinics",
        competitiveAdvantage: { differentiation: "Better", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: [],
        confidence: { overall: "HIGH", reason: "test" },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
      } as BIValidatedOutput;

      const result = detectFalseIntelligence(output, "test");

      expect(result.evidence.hypotheses.some(h => h.includes("validation"))).toBe(true);
      expect(result.confidence.overall).toBe("MEDIUM");
    });

    it("should not downgrade MEDIUM confidence", () => {
      const output = {
        businessSnapshot: "Generates $10M ARR",
        metrics: { marketDifficulty: 5, automationPotential: 50, revenueScalability: 5, operationalComplexity: 5, aiAdoptionOpportunity: 50 },
        targetMarket: "1000 clinics",
        competitiveAdvantage: { differentiation: "Better than Salesforce", defensibility: "Strong", scalabilityEdge: "Cloud" },
        automations: ["Clay integration automates leads"],
        confidence: { overall: "MEDIUM", reason: "test" },
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
      } as BIValidatedOutput;

      const result = detectFalseIntelligence(output, "test");

      expect(result.confidence.overall).toBe("MEDIUM");
    });
  });

  describe("addValidationMetadata", () => {
    it("should return IDEA level for new idea", () => {
      const output = {
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
        criticalUnknowns: [],
        moduleContext: { website: { positioning: "UNKNOWN", conversionGoal: "UNKNOWN" }, chatbot: { primaryRole: "UNKNOWN", requiredCapabilities: "UNKNOWN" }, automation: { highestValueWorkflow: "UNKNOWN", recommendedIntegrations: [] }, execution: { recommendedAgents: [], prioritySequence: [] } },
      } as BIValidatedOutput;

      const result = addValidationMetadata(output, "AI thing");

      expect(result.validation.validationLevel).toBe("IDEA");
      expect(result.validation.requiresHumanValidation).toContain("Conduct customer discovery to move beyond IDEA stage");
    });

    it("should return TRACTION level for paying users", () => {
      const output = {
        businessSnapshot: "Paying customers with $10k MRR",
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
        criticalUnknowns: [],
        moduleContext: { website: { positioning: "AI scheduling", conversionGoal: "Demo" }, chatbot: { primaryRole: "Demo booking", requiredCapabilities: "Calendar" }, automation: { highestValueWorkflow: "Reminders", recommendedIntegrations: ["EMR"] }, execution: { recommendedAgents: ["Scheduler"], prioritySequence: ["Pilot"] } },
      } as BIValidatedOutput;

      const result = addValidationMetadata(output, "test");

      expect(result.validation.validationLevel).toBe("TRACTION");
    });

    it("should return SCALE level for scale indicators", () => {
      const output = {
        businessSnapshot: "Series A funding, scaling to 1000 customers, $5M ARR",
        evidence: { facts: [], inferences: [], hypotheses: [], unknowns: [] },
        criticalUnknowns: [],
        moduleContext: { website: { positioning: "AI scheduling", conversionGoal: "Demo" }, chatbot: { primaryRole: "Demo booking", requiredCapabilities: "Calendar" }, automation: { highestValueWorkflow: "Reminders", recommendedIntegrations: ["EMR"] }, execution: { recommendedAgents: ["Scheduler"], prioritySequence: ["Pilot"] } },
      } as BIValidatedOutput;

      const result = addValidationMetadata(output, "test");

      expect(result.validation.validationLevel).toBe("SCALE");
    });
  });
});