import { pgTable, uuid, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userUsageTable = pgTable("user_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  biGenerations: integer("bi_generations").notNull().default(0),
  websiteGenerations: integer("website_generations").notNull().default(0),
  chatbotGenerations: integer("chatbot_generations").notNull().default(0),
  automationGenerations: integer("automation_generations").notNull().default(0),
  orchestratorGenerations: integer("orchestrator_generations").notNull().default(0),
  marcusMessages: integer("marcus_messages").notNull().default(0),
  totalGenerations: integer("total_generations").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("user_usage_unique").on(t.userId, t.year, t.month),
]);

export type UserUsage = typeof userUsageTable.$inferSelect;
