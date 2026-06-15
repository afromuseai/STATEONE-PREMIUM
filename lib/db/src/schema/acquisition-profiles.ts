import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { waitlistTable } from "./waitlist";

export type AcquisitionStatus = "waitlisted" | "invited" | "signed_up" | "converted";

export const acquisitionProfilesTable = pgTable("acquisition_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  company: text("company"),
  source: text("source").notNull().default("direct"),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  status: text("status").notNull().default("waitlisted"),
  notes: text("notes"),
  conversionScore: integer("conversion_score").notNull().default(0),
  waitlistEntryId: uuid("waitlist_entry_id").references(() => waitlistTable.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("acq_email_idx").on(t.email),
  index("acq_source_idx").on(t.source),
  index("acq_status_idx").on(t.status),
]);

export type AcquisitionProfile = typeof acquisitionProfilesTable.$inferSelect;
export type InsertAcquisitionProfile = typeof acquisitionProfilesTable.$inferInsert;
