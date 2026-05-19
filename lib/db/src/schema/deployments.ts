import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const deploymentsTable = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull().default("vercel"),
  status: text("status").notNull().default("pending"),
  url: text("url"),
  domain: text("domain"),
  environment: text("environment").notNull().default("production"),
  logs: jsonb("logs").default([]),
  history: jsonb("history").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Deployment = typeof deploymentsTable.$inferSelect;
