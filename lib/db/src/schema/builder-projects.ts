import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const builderProjectsTable = pgTable("builder_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  style: text("style").notNull().default("Modern SaaS"),
  industry: text("industry").notNull().default("SaaS"),
  fullHtml: text("full_html"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBuilderProjectSchema = createInsertSchema(builderProjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBuilderProject = z.infer<typeof insertBuilderProjectSchema>;
export type BuilderProject = typeof builderProjectsTable.$inferSelect;
