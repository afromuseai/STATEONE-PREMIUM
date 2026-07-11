/**
 * STAGEONE BI Intelligence Context
 *
 * Shared contract between Business Intelligence and downstream modules.
 * This is the ONLY data passed between modules - no raw prompts, no memories,
 * no other project data. Pure intelligence context.
 */

export interface BIIntelligenceContext {
  // Core business intelligence
  businessSnapshot: string;
  targetMarket: string;

  // Evidence layer
  evidence: {
    facts: string[];
    inferences: string[];
    hypotheses: string[];
    unknowns: string[];
  };

  // Confidence assessment
  confidence: {
    overall: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  };

  // Decision priorities
  decisionPriorities: string[];

  // Module-specific intelligence
  moduleContext: {
    website: {
      positioning: string;
      conversionGoal: string;
      recommendedPages: string[];
      primaryCTA: string;
    };

    chatbot: {
      primaryRole: string;
      requiredCapabilities: string;
      qualificationQuestions: string[];
      escalationRules: string;
    };

    automation: {
      highestValueWorkflow: string;
      recommendedIntegrations: string[];
      businessProcess: string;
    };

    execution: {
      recommendedAgents: string[];
      prioritySequence: string[];
    };
  };
}

/**
 * Creates a minimal fallback context when BI data is incomplete
 */
export function createFallbackBIContext(idea: string): BIIntelligenceContext {
  return {
    businessSnapshot: `Business concept: ${idea}`,
    targetMarket: "To be defined",
    evidence: {
      facts: [],
      inferences: [],
      hypotheses: [],
      unknowns: ["Full BI analysis not available"],
    },
    confidence: {
      overall: "LOW",
      reason: "BI context not available - using fallback",
    },
    decisionPriorities: ["Run full BI analysis first"],
    moduleContext: {
      website: {
        positioning: "To be defined",
        conversionGoal: "Lead capture",
        recommendedPages: ["Homepage", "Features", "Pricing", "Contact"],
        primaryCTA: "Get Started",
      },
      chatbot: {
        primaryRole: "Customer support and lead capture",
        requiredCapabilities: "Basic Q&A, lead capture",
        qualificationQuestions: ["What is your main challenge?", "What is your timeline?"],
        escalationRules: "Escalate to human for complex queries",
      },
      automation: {
        highestValueWorkflow: "Lead capture → Email sequence",
        recommendedIntegrations: ["Email", "CRM"],
        businessProcess: "Basic lead nurture",
      },
      execution: {
        recommendedAgents: ["Website Builder", "Lead Qualifier"],
        prioritySequence: ["Website", "Lead Capture"],
      },
    },
  };
}

/**
 * Validates that a BI context has minimum required fields
 */
export function validateBIContext(context: unknown): context is BIIntelligenceContext {
  if (!context || typeof context !== "object") return false;
  const ctx = context as Record<string, unknown>;
  return (
    typeof ctx.businessSnapshot === "string" &&
    typeof ctx.targetMarket === "string" &&
    typeof ctx.confidence === "object" &&
    typeof ctx.moduleContext === "object"
  );
}

/**
 * Extracts BI context from a full BI output
 */
export function extractBIContext(biOutput: Record<string, unknown>): BIIntelligenceContext {
  const evidence = (biOutput.evidence as Record<string, string[]>) || {
    facts: [],
    inferences: [],
    hypotheses: [],
    unknowns: [],
  };

  const confidence = (biOutput.confidence as Record<string, string>) || {
    overall: "LOW",
    reason: "Not provided",
  };

  const moduleContext = (biOutput.moduleContext as Record<string, unknown>) || {};

  const website = (moduleContext.website as Record<string, unknown>) || {};
  const chatbot = (moduleContext.chatbot as Record<string, unknown>) || {};
  const automation = (moduleContext.automation as Record<string, unknown>) || {};
  const execution = (moduleContext.execution as Record<string, unknown>) || {};

  return {
    businessSnapshot: (biOutput.businessSnapshot as string) || "Not provided",
    targetMarket: (biOutput.targetMarket as string) || "Not provided",
    evidence: {
      facts: evidence.facts || [],
      inferences: evidence.inferences || [],
      hypotheses: evidence.hypotheses || [],
      unknowns: evidence.unknowns || [],
    },
    confidence: {
      overall: (confidence.overall as "HIGH" | "MEDIUM" | "LOW") || "LOW",
      reason: confidence.reason || "Not provided",
    },
    decisionPriorities: (biOutput.decisionPriorities as string[]) || [],
    moduleContext: {
      website: {
        positioning: (website.positioning as string) || "To be defined",
        conversionGoal: (website.conversionGoal as string) || "Lead capture",
        recommendedPages: (website.recommendedPages as string[]) || ["Homepage", "Features", "Pricing", "Contact"],
        primaryCTA: (website.primaryCTA as string) || "Get Started",
      },
      chatbot: {
        primaryRole: (chatbot.primaryRole as string) || "Customer support and lead capture",
        requiredCapabilities: (chatbot.requiredCapabilities as string) || "Basic Q&A, lead capture",
        qualificationQuestions: (chatbot.qualificationQuestions as string[]) || ["What is your main challenge?", "What is your timeline?"],
        escalationRules: (chatbot.escalationRules as string) || "Escalate to human for complex queries",
      },
      automation: {
        highestValueWorkflow: (automation.highestValueWorkflow as string) || "Lead capture → Email sequence",
        recommendedIntegrations: (automation.recommendedIntegrations as string[]) || ["Email", "CRM"],
        businessProcess: (automation.businessProcess as string) || "Basic lead nurture",
      },
      execution: {
        recommendedAgents: (execution.recommendedAgents as string[]) || ["Website Builder", "Lead Qualifier"],
        prioritySequence: (execution.prioritySequence as string[]) || ["Website", "Lead Capture"],
      },
    },
  };
}