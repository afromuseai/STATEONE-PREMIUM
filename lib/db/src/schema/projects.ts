import { pgTable, text, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  businessIdea: text("business_idea").notNull(),
  status: text("status").notNull().default("active"),
  output: jsonb("output"),
  websiteOutput: jsonb("website_output"),
  websiteVersionHistory: jsonb("website_version_history"),
  chatbotOutput: jsonb("chatbot_output"),
  automationOutput: jsonb("automation_output"),
  projectEvents: jsonb("project_events"),
  shareToken: text("share_token").unique(),
  isPublic: boolean("is_public").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
