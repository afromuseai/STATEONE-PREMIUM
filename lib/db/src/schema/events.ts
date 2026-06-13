import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id"),
  type: text("type").notNull(),
  data: jsonb("data").default({}),
  country: text("country"),
  city: text("city"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("events_type_idx").on(t.type),
  index("events_user_idx").on(t.userId),
  index("events_created_idx").on(t.createdAt),
]);

export type Event = typeof eventsTable.$inferSelect;
export type InsertEvent = typeof eventsTable.$inferInsert;
