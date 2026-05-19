import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const autonomousSignalsTable = pgTable("autonomous_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  issueType: text("issue_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  detectedIn: text("detected_in").notNull(),
  priority: integer("priority").notNull().default(3),
  decisionType: text("decision_type").notNull().default("SUGGEST"),
  revenueImpact: text("revenue_impact").notNull().default("low"),
  isResolved: boolean("is_resolved").default(false),
  wasActedOn: boolean("was_acted_on").default(false),
  actionPath: text("action_path"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export type AutonomousSignal = typeof autonomousSignalsTable.$inferSelect;
export type NewAutonomousSignal = typeof autonomousSignalsTable.$inferInsert;
