import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userMonitorSessionsTable = pgTable("user_monitor_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  country: text("country"),
  city: text("city"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  currentPage: text("current_page"),
  lastAction: text("last_action"),
}, (t) => [
  index("ums_user_idx").on(t.userId),
  index("ums_token_idx").on(t.sessionToken),
  index("ums_active_idx").on(t.isActive),
  index("ums_last_seen_idx").on(t.lastSeenAt),
]);

export type UserMonitorSession = typeof userMonitorSessionsTable.$inferSelect;
export type InsertUserMonitorSession = typeof userMonitorSessionsTable.$inferInsert;
