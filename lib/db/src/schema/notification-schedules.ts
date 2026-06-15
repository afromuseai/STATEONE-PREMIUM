import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationSchedulesTable = pgTable("notification_schedules", {
  id:           uuid("id").primaryKey().defaultRandom(),
  title:        text("title").notNull(),
  message:      text("message").notNull(),
  type:         text("type").notNull().default("announcement"),
  segment:      text("segment").notNull().default("all"),
  targetUserId: uuid("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status:       text("status").notNull().default("pending"),
  createdBy:    uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  sentAt:       timestamp("sent_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ns_status_idx").on(t.status),
  index("ns_scheduled_for_idx").on(t.scheduledFor),
]);

export type NotificationSchedule = typeof notificationSchedulesTable.$inferSelect;
export type InsertNotificationSchedule = typeof notificationSchedulesTable.$inferInsert;
