import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const businessEventsTable = pgTable("business_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // Event classification
  eventType: text("event_type").notNull(),
  // "business.generated" | "website.generated" | "website.regenerated" |
  // "chatbot.generated" | "automation.generated" | "pricing.updated" |
  // "workflow.created" | "goal.added" | "risk.detected" | "graph.updated"

  // Human-readable label shown on the timeline
  label: text("label").notNull(),

  // Optional description (richer than label)
  description: text("description"),

  // Arbitrary structured payload
  metadata: jsonb("metadata").default({}),

  // ISO timestamp (indexed for timeline queries)
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessEvent = typeof businessEventsTable.$inferSelect;
export type InsertBusinessEvent = typeof businessEventsTable.$inferInsert;
