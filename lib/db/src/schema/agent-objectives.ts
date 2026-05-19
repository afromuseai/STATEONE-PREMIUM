import { pgTable, text, uuid, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { agentsTable } from "./agents";

export const agentObjectivesTable = pgTable("agent_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" }),
  agentKey: text("agent_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  goals: jsonb("goals").default([]),
  constraints: text("constraints").array().default([]),
  executionRules: text("execution_rules").array().default([]),
  escalationThreshold: integer("escalation_threshold").notNull().default(80),
  progress: integer("progress").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgentObjective = typeof agentObjectivesTable.$inferSelect;
