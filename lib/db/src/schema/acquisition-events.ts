import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { acquisitionProfilesTable } from "./acquisition-profiles";

export type AcquisitionEventType =
  | "landing_page_view"
  | "waitlist_join"
  | "invite_sent"
  | "signup"
  | "upgrade"
  | "referral";

export const acquisitionEventsTable = pgTable("acquisition_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  acquisitionProfileId: uuid("acquisition_profile_id").references(() => acquisitionProfilesTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  source: text("source"),
  campaign: text("campaign"),
  country: text("country"),
  city: text("city"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("acqev_source_idx").on(t.source),
  index("acqev_type_idx").on(t.eventType),
  index("acqev_created_idx").on(t.createdAt),
]);

export type AcquisitionEvent = typeof acquisitionEventsTable.$inferSelect;
export type InsertAcquisitionEvent = typeof acquisitionEventsTable.$inferInsert;
