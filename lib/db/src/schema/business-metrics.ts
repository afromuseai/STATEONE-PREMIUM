import { pgTable, text, uuid, timestamp, jsonb, real, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const businessMetricsTable = pgTable("business_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id"),
  metricKey: text("metric_key").notNull(),
  metricValue: real("metric_value").notNull().default(0),
  previousValue: real("previous_value").default(0),
  trend: text("trend").notNull().default("stable"),
  category: text("category").notNull().default("general"),
  period: text("period").notNull().default("monthly"),
  forecastValue: real("forecast_value"),
  forecastConfidence: integer("forecast_confidence").default(0),
  unit: text("unit"),
  tags: text("tags").array().default([]),
  metadata: jsonb("metadata").default({}),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessMetric = typeof businessMetricsTable.$inferSelect;
