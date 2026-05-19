import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type Plan = "free" | "pro" | "enterprise";
export type SubStatus = "active" | "cancelled" | "past_due";

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  aiGenerationsUsed: integer("ai_generations_used").notNull().default(0),
  aiGenerationsLimit: integer("ai_generations_limit").notNull().default(10),
  deploymentsUsed: integer("deployments_used").notNull().default(0),
  deploymentsLimit: integer("deployments_limit").notNull().default(2),
  workspacesUsed: integer("workspaces_used").notNull().default(1),
  workspacesLimit: integer("workspaces_limit").notNull().default(1),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull().$default(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
