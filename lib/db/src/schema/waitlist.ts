import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const waitlistTable = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  plan: text("plan").notNull().default("enterprise"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WaitlistEntry = typeof waitlistTable.$inferSelect;
