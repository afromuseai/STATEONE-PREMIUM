import { pgTable, text, uuid, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const couponsTable = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("percentage"),
  value: real("value").notNull(),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabled: boolean("disabled").notNull().default(false),
  description: text("description"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
