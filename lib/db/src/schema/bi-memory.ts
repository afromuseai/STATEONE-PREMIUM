import { pgTable, text, uuid, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const biMemoryTable = pgTable("bi_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" }),

  // Industry pattern
  industry: text("industry").notNull(),
  industryPattern: text("industry_pattern"),
  // e.g., "SaaS: B2B vertical with high automation potential"

  // Business model learnings
  businessModel: text("business_model"),
  // e.g., "Subscription B2B SaaS with tiered pricing"

  // Market insights
  marketDifficulty: integer("market_difficulty"),
  // 1-10 from BI metrics

  automationPotential: integer("automation_potential"),
  // 1-100 from BI metrics

  revenueScalability: integer("revenue_scalability"),
  // 1-10 from BI metrics

  // Strategic learnings
  growthBottleneck: text("growth_bottleneck"),
  fastestChannel: text("fastest_channel"),
  highestLeverageAutomation: text("highest_leverage_automation"),
  operationalRisk: text("operational_risk"),

  // Competitive learnings
  competitiveDifferentiation: text("competitive_differentiation"),
  competitiveDefensibility: text("competitive_defensibility"),
  competitiveScalabilityEdge: text("competitive_scalability_edge"),

  // Module context learnings
  websitePositioning: text("website_positioning"),
  websiteConversionGoal: text("website_conversion_goal"),
  chatbotPrimaryRole: text("chatbot_primary_role"),
  chatbotRequiredCapabilities: text("chatbot_required_capabilities"),
  automationHighestValueWorkflow: text("automation_highest_value_workflow"),
  automationRecommendedIntegrations: jsonb("automation_recommended_integrations").default([]),
  executionRecommendedAgents: jsonb("execution_recommended_agents").default([]),
  executionPrioritySequence: jsonb("execution_priority_sequence").default([]),

  // Evidence tracking
  evidenceFacts: jsonb("evidence_facts").default([]),
  evidenceInferences: jsonb("evidence_inferences").default([]),
  evidenceHypotheses: jsonb("evidence_hypotheses").default([]),
  evidenceUnknowns: jsonb("evidence_unknowns").default([]),

  // Quality metrics
  qualityScore: integer("quality_score"),
  completeness: integer("completeness"),
  evidenceStrength: integer("evidence_strength"),
  actionability: integer("actionability"),

  // Validation
  validationLevel: text("validation_level").default("IDEA"),
  // "IDEA" | "SIGNAL" | "MVP" | "TRACTION" | "SCALE"
  requiresHumanValidation: jsonb("requires_human_validation").default([]),

  // Feedback
  feedbackCorrect: boolean("feedback_correct"),
  feedbackNotes: text("feedback_notes"),

  // Usage tracking
  timesRetrieved: integer("times_retrieved").default(0),
  lastRetrievedAt: timestamp("last_retrieved_at"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BiMemory = typeof biMemoryTable.$inferSelect;
export type InsertBiMemory = typeof biMemoryTable.$inferInsert;