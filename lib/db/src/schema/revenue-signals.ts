import { pgTable, uuid, text, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const revenueSignalsTable = pgTable("revenue_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  industry: text("industry").notNull().default("General"),
  businessSnapshot: text("business_snapshot"),
  estimatedArrUplift: real("estimated_arr_uplift").default(0),
  conversionImpact: real("conversion_impact").default(0),
  automationSavings: real("automation_savings").default(0),
  leadGenImprovement: real("lead_gen_improvement").default(0),
  engagementIncrease: real("engagement_increase").default(0),
  overallRevenueScore: integer("overall_revenue_score").default(0),
  confidenceScore: integer("confidence_score").default(70),
  tier: text("tier").notNull().default("medium"),
  decisionType: text("decision_type").notNull().default("SUGGEST"),
  priority: integer("priority").notNull().default(3),
  signals: jsonb("signals").default({}),
  sourceMetrics: jsonb("source_metrics").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RevenueSignal = typeof revenueSignalsTable.$inferSelect;
export type NewRevenueSignal = typeof revenueSignalsTable.$inferInsert;
