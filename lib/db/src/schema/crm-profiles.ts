import { pgTable, text, uuid, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type CrmLifecycleStage = "new" | "activated" | "engaged" | "power_user" | "at_risk" | "churned";

export const crmProfilesTable = pgTable("crm_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  lifecycleStage: text("lifecycle_stage").notNull().default("new"),
  engagementScore: integer("engagement_score").notNull().default(0),
  activityScore: integer("activity_score").notNull().default(0),
  valueScore: integer("value_score").notNull().default(0),
  churnRiskScore: integer("churn_risk_score").notNull().default(0),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastGenerationAt: timestamp("last_generation_at", { withTimezone: true }),
  tags: jsonb("tags").notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("crm_user_idx").on(t.userId),
  index("crm_lifecycle_idx").on(t.lifecycleStage),
  index("crm_churn_idx").on(t.churnRiskScore),
]);

export type CrmProfile = typeof crmProfilesTable.$inferSelect;
export type InsertCrmProfile = typeof crmProfilesTable.$inferInsert;
