import { pgTable, text, uuid, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agentMemoryTable = pgTable("agent_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  agentKey: text("agent_key").notNull(),
  memoryType: text("memory_type").notNull().default("context"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  metadata: jsonb("metadata").default({}),
  importance: integer("importance").notNull().default(5),
  isShared: boolean("is_shared").notNull().default(false),
  sharedWithAgents: text("shared_with_agents").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgentMemory = typeof agentMemoryTable.$inferSelect;
