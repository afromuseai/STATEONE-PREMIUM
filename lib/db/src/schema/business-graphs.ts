import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const businessGraphsTable = pgTable("business_graphs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // Business Identity
  identity: jsonb("identity").default({}),
  // { name, summary, industry, category, stage }

  // Audience
  audience: jsonb("audience").default({}),
  // { targetAudience, customerProfiles, customerProblems }

  // Positioning
  positioning: jsonb("positioning").default({}),
  // { valueProposition, differentiation, competitiveAdvantages }

  // Revenue
  revenue: jsonb("revenue").default({}),
  // { pricingModel, monetizationStrategy }

  // Assets
  assets: jsonb("assets").default({}),
  // { websites: [], chatbots: [], automations: [], workflows: [] }

  // Operations
  operations: jsonb("operations").default({}),
  // { onboarding, leadGeneration, retention, support }

  // Risks
  risks: jsonb("risks").default({}),
  // { knownRisks: [], assumptions: [], gaps: [] }

  // Goals
  goals: jsonb("goals").default({}),
  // { shortTerm: [], longTerm: [] }

  // Raw AI outputs for reconstruction
  rawIntelligence: jsonb("raw_intelligence"),
  rawWebsite: jsonb("raw_website"),

  version: text("version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BusinessGraph = typeof businessGraphsTable.$inferSelect;
export type InsertBusinessGraph = typeof businessGraphsTable.$inferInsert;
