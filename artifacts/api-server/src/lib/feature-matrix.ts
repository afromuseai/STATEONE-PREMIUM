// ─── STAGEONE Feature Gate Matrix ─────────────────────────────────────────────
// Single source of truth for which plan unlocks which feature.
// All enforcement goes through canAccessFeature(); never hardcode plan checks.

export type Feature =
  | "bi_generator"
  | "website_generator"
  | "chatbot_generator"
  | "automation_builder"
  | "marcus_copilot"
  | "ai_builder";

export type PlanTier = "free" | "pro" | "startup" | "enterprise";

// Ordered tiers — higher index = higher plan
const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  startup: 2,
  enterprise: 3,
};

// Minimum plan required to access each feature
const FEATURE_REQUIRED_PLAN: Record<Feature, PlanTier> = {
  bi_generator:       "free",       // Free: BI analysis only
  website_generator:  "pro",        // Pro+: AI Website Builder
  chatbot_generator:  "pro",        // Pro+: AI Chatbot Generator
  automation_builder: "pro",        // Pro+: Automation Builder
  marcus_copilot:     "pro",        // Pro+: Marcus AI Copilot
  ai_builder:         "pro",        // Pro+: AI Builder
};

export const FEATURE_LABELS: Record<Feature, string> = {
  bi_generator:       "Business Intelligence",
  website_generator:  "AI Website Builder",
  chatbot_generator:  "AI Chatbot Generator",
  automation_builder: "Automation Builder",
  marcus_copilot:     "Marcus AI Copilot",
  ai_builder:         "AI Builder",
};

export function canAccessFeature(userPlan: string, feature: Feature): boolean {
  const userLevel = PLAN_ORDER[userPlan as PlanTier] ?? 0;
  const requiredLevel = PLAN_ORDER[FEATURE_REQUIRED_PLAN[feature]];
  return userLevel >= requiredLevel;
}

export function getRequiredPlan(feature: Feature): PlanTier {
  return FEATURE_REQUIRED_PLAN[feature];
}

export function getPlanLimits(plan: PlanTier) {
  const LIMITS: Record<PlanTier, { aiGenerationsLimit: number; deploymentsLimit: number; workspacesLimit: number }> = {
    free:       { aiGenerationsLimit: 5,    deploymentsLimit: 2,    workspacesLimit: 1 },
    pro:        { aiGenerationsLimit: 100,  deploymentsLimit: 20,   workspacesLimit: 5 },
    startup:    { aiGenerationsLimit: 500,  deploymentsLimit: 100,  workspacesLimit: 20 },
    enterprise: { aiGenerationsLimit: 9999, deploymentsLimit: 9999, workspacesLimit: 9999 },
  };
  return LIMITS[plan];
}
