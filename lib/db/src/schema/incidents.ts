import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const incidentsTable = pgTable(
  "incidents",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    title:            text("title").notNull(),
    description:      text("description").notNull(),
    severity:         text("severity").notNull().default("warning"),  // info | warning | critical
    affectedSystems:  jsonb("affected_systems").$type<string[]>().notNull().default([]),
    status:           text("status").notNull().default("investigating"), // investigating | identified | monitoring | resolved
    createdBy:        uuid("created_by").notNull(),
    resolvedAt:       timestamp("resolved_at", { withTimezone: true }),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("incidents_status_idx").on(t.status),
    index("incidents_severity_idx").on(t.severity),
    index("incidents_created_idx").on(t.createdAt),
  ]
);

export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = typeof incidentsTable.$inferInsert;
