import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  adminId:          uuid("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  adminEmail:       text("admin_email").notNull(),
  action:           text("action").notNull(),
  targetUserId:     uuid("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetUserEmail:  text("target_user_email"),
  details:          jsonb("details").notNull().default({}),
  ipHash:           text("ip_hash"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("aal_admin_idx").on(t.adminId),
  index("aal_target_idx").on(t.targetUserId),
  index("aal_action_idx").on(t.action),
  index("aal_created_at_idx").on(t.createdAt),
]);

export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
