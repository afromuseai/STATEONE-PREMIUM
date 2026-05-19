import { pgTable, text, uuid, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const impactTrackingTable = pgTable("impact_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  outputType: text("output_type").notNull(),
  expectedImpact: text("expected_impact").notNull().default("medium"),
  confidenceScore: integer("confidence_score").notNull().default(70),
  optimizationGoal: text("optimization_goal").notNull().default("growth"),
  feedbackRating: integer("feedback_rating"),
  usefulnessScore: integer("usefulness_score"),
  feedbackNote: text("feedback_note"),
  implementationStatus: text("implementation_status").notNull().default("pending"),
  signals: jsonb("signals").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recommendationOutcomesTable = pgTable("recommendation_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  impactTrackingId: uuid("impact_tracking_id")
    .references(() => impactTrackingTable.id, { onDelete: "cascade" }),
  recommendationType: text("recommendation_type").notNull(),
  recommendationText: text("recommendation_text").notNull(),
  outcome: text("outcome").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImpactTracking = typeof impactTrackingTable.$inferSelect;
export type InsertImpactTracking = typeof impactTrackingTable.$inferInsert;
export type RecommendationOutcome = typeof recommendationOutcomesTable.$inferSelect;
export type InsertRecommendationOutcome = typeof recommendationOutcomesTable.$inferInsert;
