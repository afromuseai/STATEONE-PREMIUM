import { db, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ProjectEvent {
  type: string;
  label: string;
  timestamp: string;
}

const MAX_EVENTS = 50;

export async function appendProjectEvent(
  projectId: string,
  userId: string,
  event: Omit<ProjectEvent, "timestamp">,
): Promise<void> {
  try {
    const [current] = await db
      .select({ projectEvents: projectsTable.projectEvents })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
      .limit(1);

    if (!current) return;

    const existing = (current.projectEvents as ProjectEvent[] | null) ?? [];
    const newEvent: ProjectEvent = { ...event, timestamp: new Date().toISOString() };
    const updated = [newEvent, ...existing].slice(0, MAX_EVENTS);

    await db
      .update(projectsTable)
      .set({ projectEvents: updated })
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  } catch {
    // Non-fatal — events are best-effort
  }
}
