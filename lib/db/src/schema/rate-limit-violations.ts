import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const rateLimitViolationsTable = pgTable(
  "rate_limit_violations",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       uuid("user_id"),
    ip:           text("ip").notNull(),
    endpoint:     text("endpoint").notNull(),
    tier:         text("tier").notNull().default("free"),
    limitType:    text("limit_type").notNull(),     // "minute" | "hour" | "day"
    requestCount: integer("request_count").notNull(),
    limit:        integer("limit").notNull(),
    blocked:      boolean("blocked").notNull().default(true),
    userAgent:    text("user_agent"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rlv_user_idx").on(t.userId),
    index("rlv_ip_idx").on(t.ip),
    index("rlv_created_idx").on(t.createdAt),
    index("rlv_endpoint_idx").on(t.endpoint),
  ]
);

export type RateLimitViolation = typeof rateLimitViolationsTable.$inferSelect;
export type InsertRateLimitViolation = typeof rateLimitViolationsTable.$inferInsert;
