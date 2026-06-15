import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userImpersonationLogsTable = pgTable("user_impersonation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  targetUserId: uuid("target_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  reason: text("reason"),
  ipHash: text("ip_hash"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => [
  index("imp_admin_idx").on(t.adminId),
  index("imp_target_idx").on(t.targetUserId),
  index("imp_started_at_idx").on(t.startedAt),
]);

export type UserImpersonationLog = typeof userImpersonationLogsTable.$inferSelect;
