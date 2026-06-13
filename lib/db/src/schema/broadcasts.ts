import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const broadcastsTable = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  target: text("target").notNull().default("all"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deliveredCount: integer("delivered_count").notNull().default(0),
  emailDelivered: boolean("email_delivered").notNull().default(false),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
export type InsertBroadcast = typeof broadcastsTable.$inferInsert;
