import { db, userUsageTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export type UsageField =
  | "biGenerations"
  | "websiteGenerations"
  | "chatbotGenerations"
  | "automationGenerations"
  | "orchestratorGenerations"
  | "marcusMessages";

const DB_COLUMN: Record<UsageField, string> = {
  biGenerations: "bi_generations",
  websiteGenerations: "website_generations",
  chatbotGenerations: "chatbot_generations",
  automationGenerations: "automation_generations",
  orchestratorGenerations: "orchestrator_generations",
  marcusMessages: "marcus_messages",
};

export async function trackUsage(userId: string, field: UsageField): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const col = DB_COLUMN[field];

  await db.execute(sql`
    INSERT INTO user_usage (id, user_id, year, month, ${sql.raw(col)}, total_generations)
    VALUES (gen_random_uuid(), ${userId}, ${year}, ${month}, 1, 1)
    ON CONFLICT (user_id, year, month) DO UPDATE SET
      ${sql.raw(col)} = user_usage.${sql.raw(col)} + 1,
      total_generations = user_usage.total_generations + 1,
      updated_at = NOW()
  `);
}

export function trackUsageFireForget(userId: string, field: UsageField): void {
  trackUsage(userId, field).catch((err) => {
    console.error("[trackUsage] failed:", (err as Error).message);
  });
}

export async function getUserUsage(userId: string): Promise<{
  lifetime: Record<UsageField, number> & { totalGenerations: number };
  currentMonth: Record<UsageField, number> & { totalGenerations: number };
}> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const rows = await db
    .select()
    .from(userUsageTable)
    .where(eq(userUsageTable.userId, userId));

  const zero = () => ({
    biGenerations: 0,
    websiteGenerations: 0,
    chatbotGenerations: 0,
    automationGenerations: 0,
    orchestratorGenerations: 0,
    marcusMessages: 0,
    totalGenerations: 0,
  });

  const lifetime = zero();
  const currentMonth = zero();

  for (const row of rows) {
    lifetime.biGenerations += row.biGenerations;
    lifetime.websiteGenerations += row.websiteGenerations;
    lifetime.chatbotGenerations += row.chatbotGenerations;
    lifetime.automationGenerations += row.automationGenerations;
    lifetime.orchestratorGenerations += row.orchestratorGenerations;
    lifetime.marcusMessages += row.marcusMessages;
    lifetime.totalGenerations += row.totalGenerations;

    if (row.year === year && row.month === month) {
      currentMonth.biGenerations = row.biGenerations;
      currentMonth.websiteGenerations = row.websiteGenerations;
      currentMonth.chatbotGenerations = row.chatbotGenerations;
      currentMonth.automationGenerations = row.automationGenerations;
      currentMonth.orchestratorGenerations = row.orchestratorGenerations;
      currentMonth.marcusMessages = row.marcusMessages;
      currentMonth.totalGenerations = row.totalGenerations;
    }
  }

  return { lifetime, currentMonth };
}
