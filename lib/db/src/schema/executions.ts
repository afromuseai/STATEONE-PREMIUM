import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const executionsTable = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("workflow"),
  status: text("status").notNull().default("queued"),
  trigger: text("trigger").notNull().default("manual"),
  priority: integer("priority").notNull().default(3),
  payload: jsonb("payload").default({}),
  result: jsonb("result").default(null),
  logs: jsonb("logs").default([]),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  durationMs: integer("duration_ms"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Execution = typeof executionsTable.$inferSelect;
