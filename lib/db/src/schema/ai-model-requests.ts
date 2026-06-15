import { pgTable, uuid, text, integer, boolean, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiModelRequestsTable = pgTable(
  "ai_model_requests",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    userId:         uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    projectId:      uuid("project_id"),
    model:          text("model").notNull(),
    provider:       text("provider").notNull(),
    feature:        text("feature").notNull(),
    inputTokens:    integer("input_tokens").notNull().default(0),
    outputTokens:   integer("output_tokens").notNull().default(0),
    totalTokens:    integer("total_tokens").notNull().default(0),
    latencyMs:      integer("latency_ms").notNull(),
    success:        boolean("success").notNull(),
    errorType:      text("error_type"),
    estimatedCost:  numeric("estimated_cost", { precision: 10, scale: 6 }).notNull().default("0"),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_req_user_idx").on(t.userId),
    index("ai_req_model_idx").on(t.model),
    index("ai_req_feature_idx").on(t.feature),
    index("ai_req_created_idx").on(t.createdAt),
    index("ai_req_success_idx").on(t.success),
  ]
);

export type AiModelRequest = typeof aiModelRequestsTable.$inferSelect;
export type InsertAiModelRequest = typeof aiModelRequestsTable.$inferInsert;
