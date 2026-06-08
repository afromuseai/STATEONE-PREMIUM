import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";
import { businessGraphsTable } from "./business-graphs";

export const memorySnapshotsTable = pgTable("memory_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  graphId: uuid("graph_id")
    .references(() => businessGraphsTable.id, { onDelete: "set null" }),

  // What triggered this snapshot
  trigger: text("trigger").notNull().default("manual"),
  // "business_intelligence" | "website_generation" | "chatbot_generation" |
  // "automation_generation" | "manual" | "scheduled"

  // Full graph state at time of snapshot
  graphSnapshot: jsonb("graph_snapshot").notNull(),

  // Summary of what changed since the previous snapshot
  changeSummary: text("change_summary"),

  // Graph schema version (for future migrations)
  schemaVersion: integer("schema_version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MemorySnapshot = typeof memorySnapshotsTable.$inferSelect;
export type InsertMemorySnapshot = typeof memorySnapshotsTable.$inferInsert;
