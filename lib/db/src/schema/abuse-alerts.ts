import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const abuseAlertsTable = pgTable(
  "abuse_alerts",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    userId:      uuid("user_id"),
    ip:          text("ip"),
    alertType:   text("alert_type").notNull(),   // excessive_generation | spam | suspicious_automation | rapid_signup | excessive_logins | content_abuse
    severity:    text("severity").notNull().default("warning"),  // info | warning | critical
    title:       text("title").notNull(),
    description: text("description").notNull(),
    metadata:    jsonb("metadata"),
    status:      text("status").notNull().default("open"),  // open | dismissed | actioned
    reviewedBy:  uuid("reviewed_by"),
    reviewedAt:  timestamp("reviewed_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("abuse_user_idx").on(t.userId),
    index("abuse_status_idx").on(t.status),
    index("abuse_type_idx").on(t.alertType),
    index("abuse_created_idx").on(t.createdAt),
  ]
);

export type AbuseAlert = typeof abuseAlertsTable.$inferSelect;
export type InsertAbuseAlert = typeof abuseAlertsTable.$inferInsert;
