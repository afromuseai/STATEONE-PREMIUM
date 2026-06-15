import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const messageCenterSendsTable = pgTable("message_center_sends", {
  id:             uuid("id").primaryKey().defaultRandom(),
  adminId:        uuid("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  adminEmail:     text("admin_email").notNull(),
  title:          text("title").notNull(),
  message:        text("message").notNull(),
  type:           text("type").notNull().default("announcement"),
  segment:        text("segment").notNull().default("all"),
  targetUserId:   uuid("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("mcs_admin_idx").on(t.adminId),
  index("mcs_created_at_idx").on(t.createdAt),
]);

export type MessageCenterSend = typeof messageCenterSendsTable.$inferSelect;
