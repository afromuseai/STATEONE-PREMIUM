import { pgTable, text, uuid, timestamp, jsonb, integer, real, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type TemplateType = "startup_website" | "ai_chatbot" | "automation_workflow" | "onboarding_system" | "crm_pipeline";

export const templatesTable = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  content: jsonb("content").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  rating: real("rating").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  tags: text("tags").array().default([]),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Template = typeof templatesTable.$inferSelect;
