import { pgTable, text, uuid, timestamp, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const generationStatusEnum = pgEnum("generation_status", [
  "generating",
  "completed",
  "failed",
]);

export const builderGenerationsTable = pgTable("builder_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id"),
  prompt: text("prompt").notNull(),
  style: text("style").notNull().default("Modern SaaS"),
  industry: text("industry").notNull().default("SaaS"),
  generatedHtml: text("generated_html"),
  generatedCss: text("generated_css"),
  generatedJs: text("generated_js"),
  websitePlan: jsonb("website_plan"),
  designDna: jsonb("design_dna"),
  generationStatus: generationStatusEnum("generation_status").notNull().default("generating"),
  modelUsed: text("model_used"),
  durationMs: integer("duration_ms"),
  tokenCount: integer("token_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BuilderGeneration = typeof builderGenerationsTable.$inferSelect;
export type InsertBuilderGeneration = typeof builderGenerationsTable.$inferInsert;
