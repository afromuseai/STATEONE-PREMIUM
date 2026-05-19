import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { agentsTable } from "./agents";

export const agentTasksTable = pgTable("agent_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" }),
  agentKey: text("agent_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  priority: integer("priority").notNull().default(3),
  confidence: integer("confidence").notNull().default(0),
  category: text("category").notNull().default("general"),
  outcome: jsonb("outcome").default(null),
  errorMessage: text("error_message"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgentTask = typeof agentTasksTable.$inferSelect;
