import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const billingEventsTable = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  provider: text("provider").notNull().default("none"),
  eventType: text("event_type").notNull(),
  plan: text("plan"),
  amountCents: integer("amount_cents"),
  currency: text("currency").default("usd"),
  status: text("status").notNull().default("received"),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingEvent = typeof billingEventsTable.$inferSelect;
