import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const errorEventsTable = pgTable("error_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  type: text("type").notNull().default("server"),
  message: text("message").notNull(),
  stack: text("stack"),
  path: text("path"),
  method: text("method"),
  statusCode: integer("status_code"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ErrorEvent = typeof errorEventsTable.$inferSelect;
