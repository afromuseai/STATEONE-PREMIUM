import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { businessGraphsTable } from "./business-graphs";

export const graphNodesTable = pgTable("graph_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphId: uuid("graph_id")
    .notNull()
    .references(() => businessGraphsTable.id, { onDelete: "cascade" }),

  // Node classification
  nodeType: text("node_type").notNull(),
  // "identity" | "audience" | "positioning" | "revenue" | "asset" |
  // "operation" | "risk" | "goal" | "insight" | "metric"

  label: text("label").notNull(),
  description: text("description"),

  // Flexible key-value payload
  data: jsonb("data").default({}),

  // Importance: 1 (low) → 10 (critical)
  importance: integer("importance").notNull().default(5),

  // Source that created/updated this node
  source: text("source").notNull().default("manual"),
  // "business_intelligence" | "website_generation" | "chatbot_generation" |
  // "automation_generation" | "manual"

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type GraphNode = typeof graphNodesTable.$inferSelect;
export type InsertGraphNode = typeof graphNodesTable.$inferInsert;
