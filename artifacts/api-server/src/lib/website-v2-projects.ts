// ─── Website Architect V2 — Project Persistence Service ──────────────────────
// All DB interactions for V2 projects. Never throws to callers — errors are
// logged and returned as null so the SSE pipeline can handle them gracefully.

import { db, websiteV2ProjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { BusinessContext, WebsiteBlueprint, ProjectFile } from "./website-v2-types";

// ─── Create a new project record in "planning" state ─────────────────────────
export async function createV2Project(
  userId: string,
  context: BusinessContext
): Promise<string | null> {
  try {
    const name = `${context.companyName} — ${context.industry}`;
    const [row] = await db
      .insert(websiteV2ProjectsTable)
      .values({
        userId,
        projectName:     name,
        status:          "planning",
        businessContext: context as unknown as Record<string, unknown>,
      })
      .returning({ id: websiteV2ProjectsTable.id });

    logger.info({ userId, projectId: row.id }, "[v2:db] Project created");
    return row.id;
  } catch (err) {
    logger.error({ err: String(err), userId }, "[v2:db] Failed to create project");
    return null;
  }
}

// ─── Save blueprint + advance status to "architecting" ───────────────────────
export async function saveBlueprint(
  projectId: string,
  blueprint: WebsiteBlueprint
): Promise<boolean> {
  try {
    await db
      .update(websiteV2ProjectsTable)
      .set({
        blueprint: blueprint as unknown as Record<string, unknown>,
        status:    "architecting",
      })
      .where(eq(websiteV2ProjectsTable.id, projectId));

    logger.info({ projectId }, "[v2:db] Blueprint saved");
    return true;
  } catch (err) {
    logger.error({ err: String(err), projectId }, "[v2:db] Failed to save blueprint");
    return false;
  }
}

// ─── Save generated files + advance status to "ready" ────────────────────────
export async function saveGeneratedFiles(
  projectId: string,
  files: ProjectFile[],
  dependencies: string[],
  preview: string
): Promise<boolean> {
  try {
    await db
      .update(websiteV2ProjectsTable)
      .set({
        files:        files as unknown as Record<string, unknown>[],
        dependencies: dependencies as unknown as Record<string, unknown>,
        preview,
        status:       "ready",
      })
      .where(eq(websiteV2ProjectsTable.id, projectId));

    logger.info({ projectId, fileCount: files.length }, "[v2:db] Files saved, project ready");
    return true;
  } catch (err) {
    logger.error({ err: String(err), projectId }, "[v2:db] Failed to save files");
    return false;
  }
}

// ─── Mark project as failed with an optional message ─────────────────────────
export async function markProjectFailed(
  projectId: string,
  message: string
): Promise<void> {
  try {
    await db
      .update(websiteV2ProjectsTable)
      .set({ status: "failed", errorMessage: message })
      .where(eq(websiteV2ProjectsTable.id, projectId));

    logger.info({ projectId }, "[v2:db] Project marked failed");
  } catch (err) {
    logger.error({ err: String(err), projectId }, "[v2:db] Failed to mark project failed");
  }
}

// ─── Retrieve a project by id ─────────────────────────────────────────────────
export async function getV2Project(projectId: string, userId: string) {
  try {
    const [row] = await db
      .select()
      .from(websiteV2ProjectsTable)
      .where(eq(websiteV2ProjectsTable.id, projectId))
      .limit(1);

    if (!row || row.userId !== userId) return null;
    return row;
  } catch (err) {
    logger.error({ err: String(err), projectId }, "[v2:db] Failed to fetch project");
    return null;
  }
}

// ─── List projects for a user (newest first) ─────────────────────────────────
export async function listV2Projects(userId: string) {
  try {
    return await db
      .select()
      .from(websiteV2ProjectsTable)
      .where(eq(websiteV2ProjectsTable.userId, userId))
      .orderBy(websiteV2ProjectsTable.createdAt);
  } catch (err) {
    logger.error({ err: String(err), userId }, "[v2:db] Failed to list projects");
    return [];
  }
}
