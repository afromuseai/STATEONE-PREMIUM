// ─── Website Architect V2 — Project persistence ───────────────────────────────
// Stores the full output of the V2 pipeline per user:
//   planning → architecting → building → ready | failed

import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const websiteV2ProjectsTable = pgTable("website_v2_projects", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id")
                     .notNull()
                     .references(() => usersTable.id, { onDelete: "cascade" }),
  projectName:     text("project_name").notNull(),
  status:          text("status").notNull().default("planning"),
  // status values: "planning" | "architecting" | "building" | "ready" | "failed"
  businessContext: jsonb("business_context").notNull(),
  blueprint:       jsonb("blueprint"),
  files:           jsonb("files"),
  dependencies:    jsonb("dependencies"),
  preview:         text("preview"),
  errorMessage:    text("error_message"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWebsiteV2ProjectSchema = createInsertSchema(websiteV2ProjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsiteV2Project = z.infer<typeof insertWebsiteV2ProjectSchema>;
export type WebsiteV2Project = typeof websiteV2ProjectsTable.$inferSelect;
