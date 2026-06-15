import { pgTable, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const featureFlagsTable = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(false),
    rolloutPercentage: integer("rollout_percentage").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("feature_flags_key_idx").on(t.key),
  ]
);

export const featureFlagRulesTable = pgTable(
  "feature_flag_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureFlagId: uuid("feature_flag_id").notNull().references(() => featureFlagsTable.id, { onDelete: "cascade" }),
    ruleType: text("rule_type", { enum: ["plan", "user", "segment"] }).notNull(),
    ruleValue: text("rule_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feature_flag_rules_flag_idx").on(t.featureFlagId),
  ]
);

export const insertFeatureFlagSchema = createInsertSchema(featureFlagsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureFlagRuleSchema = createInsertSchema(featureFlagRulesTable).omit({
  id: true,
  createdAt: true,
});

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlagRule = typeof featureFlagRulesTable.$inferSelect;
export type InsertFeatureFlagRule = z.infer<typeof insertFeatureFlagRuleSchema>;
