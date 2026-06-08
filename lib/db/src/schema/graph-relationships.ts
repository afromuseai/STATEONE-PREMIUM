import { pgTable, text, uuid, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { graphNodesTable } from "./graph-nodes";
import { businessGraphsTable } from "./business-graphs";

export const graphRelationshipsTable = pgTable("graph_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphId: uuid("graph_id")
    .notNull()
    .references(() => businessGraphsTable.id, { onDelete: "cascade" }),

  sourceNodeId: uuid("source_node_id")
    .notNull()
    .references(() => graphNodesTable.id, { onDelete: "cascade" }),
  targetNodeId: uuid("target_node_id")
    .notNull()
    .references(() => graphNodesTable.id, { onDelete: "cascade" }),

  // Relationship type
  relationshipType: text("relationship_type").notNull(),
  // "serves" | "supports" | "risks" | "enables" | "requires" | "conflicts"

  label: text("label"),
  strength: real("strength").notNull().default(1.0), // 0.0 → 1.0
  metadata: jsonb("metadata").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GraphRelationship = typeof graphRelationshipsTable.$inferSelect;
export type InsertGraphRelationship = typeof graphRelationshipsTable.$inferInsert;
