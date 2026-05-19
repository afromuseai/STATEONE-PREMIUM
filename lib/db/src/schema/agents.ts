import { pgTable, text, uuid, timestamp, jsonb, boolean, real, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("active"),
  config: jsonb("config").default({}),
  behaviorRules: text("behavior_rules").array().default([]),
  integrations: text("integrations").array().default([]),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  rating: real("rating").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Agent = typeof agentsTable.$inferSelect;
