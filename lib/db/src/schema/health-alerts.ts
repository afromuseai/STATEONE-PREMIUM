import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const healthAlertsTable = pgTable(
  "health_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull().default("info"),
    dismissed: boolean("dismissed").notNull().default(false),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissedBy: uuid("dismissed_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("health_alerts_dismissed_idx").on(t.dismissed),
    index("health_alerts_severity_idx").on(t.severity),
    index("health_alerts_created_idx").on(t.createdAt),
  ]
);

export type HealthAlert = typeof healthAlertsTable.$inferSelect;
export type InsertHealthAlert = typeof healthAlertsTable.$inferInsert;
