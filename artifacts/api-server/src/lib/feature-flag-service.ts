import { db, featureFlagsTable, featureFlagRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface FeatureFlagWithRules {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  createdAt: Date;
  updatedAt: Date;
  rules: Array<{ id: string; ruleType: string; ruleValue: string; createdAt: Date }>;
}

async function getFlagWithRules(featureKey: string): Promise<FeatureFlagWithRules | null> {
  const flags = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, featureKey))
    .limit(1);

  const flag = flags[0];
  if (!flag) return null;

  const rules = await db
    .select()
    .from(featureFlagRulesTable)
    .where(eq(featureFlagRulesTable.featureFlagId, flag.id));

  return { ...flag, rules };
}

function deterministicInRollout(userId: string, rolloutPct: number): boolean {
  if (rolloutPct >= 100) return true;
  if (rolloutPct <= 0) return false;
  // Simple deterministic hash: sum of char codes mod 100
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return (hash % 100) < rolloutPct;
}

export const FeatureFlagService = {
  async isEnabled(featureKey: string): Promise<boolean> {
    try {
      const flag = await getFlagWithRules(featureKey);
      if (!flag) return false;
      if (!flag.enabled) return false;
      return flag.rolloutPercentage >= 100;
    } catch {
      return false;
    }
  },

  async isEnabledForUser(featureKey: string, userId: string, plan?: string): Promise<boolean> {
    try {
      const flag = await getFlagWithRules(featureKey);
      if (!flag) return false;
      if (!flag.enabled) return false;

      const rules = flag.rules;

      // Priority 1: Explicit user rule
      const userRule = rules.find((r) => r.ruleType === "user" && r.ruleValue === userId);
      if (userRule) return true;

      // Priority 2: Segment rule (future-proof — check power_users segment)
      const segmentRules = rules.filter((r) => r.ruleType === "segment");
      if (segmentRules.length > 0) {
        // Segment matching is extensible — currently we fail closed for unknown segments
      }

      // Priority 3: Plan rule
      if (plan) {
        const planRule = rules.find((r) => r.ruleType === "plan" && r.ruleValue === plan);
        if (planRule) return true;
      }

      // Priority 4: Global flag with rollout %
      return deterministicInRollout(userId, flag.rolloutPercentage);
    } catch {
      return false;
    }
  },

  async isEnabledForPlan(featureKey: string, plan: string): Promise<boolean> {
    try {
      const flag = await getFlagWithRules(featureKey);
      if (!flag) return false;
      if (!flag.enabled) return false;

      const planRule = flag.rules.find((r) => r.ruleType === "plan" && r.ruleValue === plan);
      if (planRule) return true;

      return false;
    } catch {
      return false;
    }
  },

  async getAllWithRules(): Promise<FeatureFlagWithRules[]> {
    try {
      const flags = await db.select().from(featureFlagsTable);
      const rules = await db.select().from(featureFlagRulesTable);

      return flags.map((flag) => ({
        ...flag,
        rules: rules.filter((r) => r.featureFlagId === flag.id),
      }));
    } catch {
      return [];
    }
  },
};

export const INITIAL_FLAGS: Array<{ key: string; name: string; description: string }> = [
  { key: "ai_builder",          name: "AI Builder",          description: "Core AI business intelligence and website builder" },
  { key: "advanced_reasoning",  name: "Advanced Reasoning",  description: "Extended chain-of-thought reasoning in AI responses" },
  { key: "website_v2",          name: "Website V2",          description: "Next-generation website builder with improved templates" },
  { key: "marcus_beta",         name: "Marcus Beta",         description: "Marcus AI copilot beta features and experimental modes" },
  { key: "automation_pro",      name: "Automation Pro",      description: "Advanced workflow automation and multi-agent orchestration" },
  { key: "future_marketplace",  name: "Future Marketplace",  description: "Template and agent marketplace (upcoming launch)" },
];
