import { pgTable, uuid, text, bigint, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const backupsTable = pgTable(
  "backups",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    backupType:   text("backup_type").notNull(),  // database | project_export | config_snapshot
    label:        text("label").notNull(),
    status:       text("status").notNull().default("pending"),  // pending | running | success | failed
    sizeBytes:    bigint("size_bytes", { mode: "number" }),
    metadata:     jsonb("metadata"),
    errorMessage: text("error_message"),
    createdBy:    uuid("created_by"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt:  timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("backups_type_idx").on(t.backupType),
    index("backups_status_idx").on(t.status),
    index("backups_created_idx").on(t.createdAt),
  ]
);

export type Backup = typeof backupsTable.$inferSelect;
export type InsertBackup = typeof backupsTable.$inferInsert;
