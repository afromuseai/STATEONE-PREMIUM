// ─── Website Architect V2 — Project Persistence Service ──────────────────────
// All DB interactions for V2 projects. Never throws to callers — errors are
// logged and returned as null so the SSE pipeline can handle them gracefully.

import { db, websiteV2ProjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { BusinessContext, WebsiteBlueprint, ProjectFile, FileModification } from "./website-v2-types";

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
// Security: always checks userId — returns null if project belongs to someone else.
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

// Alias used by the project retrieval routes.
export const getProject = getV2Project;

// ─── List projects for a user — summary columns only (newest first) ───────────
// Heavy JSONB fields (files, blueprint, preview) are excluded to keep the
// list response lean. The detail endpoint returns the full record.
export async function listProjects(userId: string) {
  try {
    return await db
      .select({
        id:          websiteV2ProjectsTable.id,
        projectName: websiteV2ProjectsTable.projectName,
        status:      websiteV2ProjectsTable.status,
        createdAt:   websiteV2ProjectsTable.createdAt,
        updatedAt:   websiteV2ProjectsTable.updatedAt,
      })
      .from(websiteV2ProjectsTable)
      .where(eq(websiteV2ProjectsTable.userId, userId))
      .orderBy(websiteV2ProjectsTable.createdAt);
  } catch (err) {
    logger.error({ err: String(err), userId }, "[v2:db] Failed to list projects");
    return [];
  }
}

// Full-column version kept for internal pipeline use.
export const listV2Projects = listProjects;

// ─── Infer language from file extension ──────────────────────────────────────
function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css"))  return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md"))   return "markdown";
  return "text";
}

// ─── Apply file modifications and persist ─────────────────────────────────────
// Applies an array of FileModification objects to the stored files array:
//   "update" — replaces content of an existing file (or creates it if missing)
//   "create" — adds a new file (or replaces if path already exists)
//   "delete" — removes the file
// Returns the updated files array and a success flag.
export async function updateProjectFiles(
  projectId: string,
  modifications: FileModification[]
): Promise<{ files: ProjectFile[]; ok: boolean }> {
  try {
    // Fetch current project (no userId check — caller's route already verified ownership)
    const [row] = await db
      .select({ files: websiteV2ProjectsTable.files })
      .from(websiteV2ProjectsTable)
      .where(eq(websiteV2ProjectsTable.id, projectId))
      .limit(1);

    if (!row) {
      logger.error({ projectId }, "[v2:db] updateProjectFiles — project not found");
      return { files: [], ok: false };
    }

    let current: ProjectFile[] = (row.files as unknown as ProjectFile[]) ?? [];

    for (const mod of modifications) {
      if (mod.operation === "delete") {
        current = current.filter((f) => f.path !== mod.path);
      } else {
        // "update" or "create" — upsert behaviour
        const idx = current.findIndex((f) => f.path === mod.path);
        const updated: ProjectFile = {
          path:      mod.path,
          operation: mod.operation,
          content:   mod.content,
          language:  inferLanguage(mod.path),
        };
        if (idx >= 0) {
          current[idx] = updated;
        } else {
          current.push(updated);
        }
      }
    }

    await db
      .update(websiteV2ProjectsTable)
      .set({ files: current as unknown as Record<string, unknown>[] })
      .where(eq(websiteV2ProjectsTable.id, projectId));

    logger.info(
      { projectId, changeCount: modifications.length, totalFiles: current.length },
      "[v2:db] Project files updated"
    );
    return { files: current, ok: true };
  } catch (err) {
    logger.error({ err: String(err), projectId }, "[v2:db] Failed to update project files");
    return { files: [], ok: false };
  }
}
