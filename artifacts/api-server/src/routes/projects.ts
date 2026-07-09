import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { appendProjectEvent } from "../lib/project-events";
import { logEventFireForget } from "../lib/log-event";

const router = Router();

const ProjectStatus = z.enum(["draft", "active", "completed", "archived"]);

const ProjectType = z.enum([
  "business_intelligence",
  "website",
  "chatbot",
  "automation",
  "orchestration",
]);

const CreateProjectBody = z.object({
  title: z.string().min(1),
  businessIdea: z.string().min(1),
  type: ProjectType.optional().default("business_intelligence"),
  status: ProjectStatus.optional().default("active"),
  output: z.record(z.unknown()).optional().nullable(),
  websiteOutput: z.record(z.unknown()).optional().nullable(),
  chatbotOutput: z.record(z.unknown()).optional().nullable(),
  automationOutput: z.record(z.unknown()).optional().nullable(),
  orchestratorOutput: z.record(z.unknown()).optional().nullable(),
});

const UpdateProjectBody = z.object({
  title: z.string().min(1).optional(),
  status: ProjectStatus.optional(),
  output: z.record(z.unknown()).optional().nullable(),
  websiteOutput: z.record(z.unknown()).optional().nullable(),
  chatbotOutput: z.record(z.unknown()).optional().nullable(),
  automationOutput: z.record(z.unknown()).optional().nullable(),
  orchestratorOutput: z.record(z.unknown()).optional().nullable(),
});

interface WebsiteVersion {
  id: string;
  savedAt: string;
  label: string;
  websiteOutput: Record<string, unknown>;
}

const MAX_VERSIONS = 10;

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.updatedAt));
  req.log.info({ event: "PROJECT_LIST", count: projects.length, ids: projects.map(p => p.id), titles: projects.map(p => p.title), userId }, "[PROJECT_LIST] returning projects");
  res.json({ projects });
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [project] = await db.insert(projectsTable).values({
    userId,
    title: parsed.data.title,
    businessIdea: parsed.data.businessIdea,
    type: parsed.data.type ?? "business_intelligence",
    status: parsed.data.status ?? "active",
    output: parsed.data.output ?? null,
    websiteOutput: parsed.data.websiteOutput ?? null,
    chatbotOutput: parsed.data.chatbotOutput ?? null,
    automationOutput: parsed.data.automationOutput ?? null,
    orchestratorOutput: parsed.data.orchestratorOutput ?? null,
  }).returning();
  logEventFireForget({ userId, projectId: project.id, type: "project_created", data: { title: project.title }, req });
  res.status(201).json({ project });
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.userId;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ project });
  logEventFireForget({ userId, projectId: id, type: "project_opened", data: { title: project.title }, req });
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.userId;

  // Determine which module is being saved for targeted logging
  const savingChatbot = "chatbotOutput" in req.body;
  const savingAutomation = "automationOutput" in req.body;
  const savingOrchestrator = "orchestratorOutput" in req.body;
  const savingWebsite = "websiteOutput" in req.body;
  const savingBI = "output" in req.body;

  if (savingChatbot) {
    req.log.info({ event: "CHATBOT_FLOW_7", projectId: id, hasChatbotOutput: req.body.chatbotOutput !== null && req.body.chatbotOutput !== undefined }, "[CHATBOT] CHATBOT_FLOW_7 — PATCH /api/projects/:id received with chatbotOutput");
  }
  if (savingAutomation) {
    req.log.info({ event: "AUTOMATION_SAVE_5", projectId: id, endpoint: `PATCH /api/projects/${id}`, hasAutomationOutput: req.body.automationOutput !== null && req.body.automationOutput !== undefined }, "[AUTOMATION] AUTOMATION_SAVE_5 — PATCH /api/projects/:id received with automationOutput");
  }
  if (savingOrchestrator) {
    req.log.info({ event: "ORCHESTRATOR_SAVE_6", projectId: id, endpoint: `PATCH /api/projects/${id}`, hasOrchestratorOutput: req.body.orchestratorOutput !== null && req.body.orchestratorOutput !== undefined }, "[ORCHESTRATOR] ORCHESTRATOR_SAVE_6 — PATCH /api/projects/:id received with orchestratorOutput");
  }

  req.log.info({ event: "PROJECT_SAVE_INCOMING", projectId: id, userId, fields: Object.keys(req.body), savingChatbot, savingAutomation, savingOrchestrator, savingWebsite, savingBI }, "[PROJECTS] PATCH incoming — logging payload shape");

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ event: "PROJECT_SAVE_VALIDATION_FAIL", projectId: id, issues: parsed.error.issues }, "[PROJECTS] PATCH validation failed — Zod rejected the payload");
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  // Fetch the current project to snapshot the existing websiteOutput before overwriting
  let currentVersionHistory: WebsiteVersion[] = [];
  let existingWebsiteOutput: Record<string, unknown> | null = null;

  if (parsed.data.websiteOutput !== undefined) {
    const [current] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

    if (current?.websiteOutput) {
      existingWebsiteOutput = current.websiteOutput as Record<string, unknown>;
      currentVersionHistory = (current.websiteVersionHistory as WebsiteVersion[] | null) ?? [];

      // Push the current websiteOutput into history before overwriting
      const versionEntry: WebsiteVersion = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        label: `Version ${currentVersionHistory.length + 1}`,
        websiteOutput: existingWebsiteOutput,
      };
      currentVersionHistory = [versionEntry, ...currentVersionHistory].slice(0, MAX_VERSIONS);
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.output !== undefined) updates.output = parsed.data.output;
  if (parsed.data.websiteOutput !== undefined) {
    updates.websiteOutput = parsed.data.websiteOutput;
    if (existingWebsiteOutput) updates.websiteVersionHistory = currentVersionHistory;
  }
  if (parsed.data.chatbotOutput !== undefined) {
    updates.chatbotOutput = parsed.data.chatbotOutput;
    req.log.info({ event: "SAVE_AUDIT", projectId: id, hasChatbotOutput: true, outputSize: JSON.stringify(parsed.data.chatbotOutput).length, timestamp: new Date().toISOString() }, "[SAVE_AUDIT] chatbotOutput present in PATCH body");
  }
  if (parsed.data.automationOutput !== undefined) updates.automationOutput = parsed.data.automationOutput;
  if (parsed.data.orchestratorOutput !== undefined) updates.orchestratorOutput = parsed.data.orchestratorOutput;

  const [project] = await db
    .update(projectsTable)
    .set(updates)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
    .returning();
  if (!project) {
    req.log.warn({ event: "PROJECT_SAVE_NOT_FOUND", projectId: id, userId }, "[PROJECTS] PATCH DB returned no rows — project not found or userId mismatch");
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (savingChatbot) {
    req.log.info({ event: "CHATBOT_FLOW_7_OK", projectId: id, hasChatbotOutput: !!project.chatbotOutput }, "[CHATBOT] CHATBOT_FLOW_7 — chatbot saved to DB successfully");
  }
  if (savingAutomation) {
    req.log.info({ event: "AUTOMATION_SAVE_6", projectId: id, hasAutomationOutput: !!project.automationOutput }, "[AUTOMATION] AUTOMATION_SAVE_6 — automation saved to DB successfully");
  }
  if (savingOrchestrator) {
    req.log.info({ event: "ORCHESTRATOR_SAVE_7", projectId: id, hasOrchestratorOutput: !!project.orchestratorOutput }, "[ORCHESTRATOR] ORCHESTRATOR_SAVE_7 — orchestrator saved to DB successfully");
  }

  // Auto-record project history events on significant saves (best-effort, non-blocking)
  if (parsed.data.output !== undefined && parsed.data.output !== null) {
    appendProjectEvent(id, userId, { type: "intelligence.generated", label: "Business Intelligence generated" }).catch(() => {});
  }
  if (parsed.data.websiteOutput !== undefined && parsed.data.websiteOutput !== null) {
    const label = existingWebsiteOutput ? "Website updated" : "Website generated";
    appendProjectEvent(id, userId, { type: "website.generated", label }).catch(() => {});
  }
  if (parsed.data.chatbotOutput !== undefined && parsed.data.chatbotOutput !== null) {
    appendProjectEvent(id, userId, { type: "chatbot.generated", label: "Chatbot generated" }).catch(() => {});
  }
  if (parsed.data.automationOutput !== undefined && parsed.data.automationOutput !== null) {
    appendProjectEvent(id, userId, { type: "automation.generated", label: "Automation workflow generated" }).catch(() => {});
  }
  if (parsed.data.orchestratorOutput !== undefined && parsed.data.orchestratorOutput !== null) {
    appendProjectEvent(id, userId, { type: "orchestration.generated", label: "Orchestration plan generated" }).catch(() => {});
  }

  res.json({ project });
});

// GET /api/projects/:id/website-versions — list saved versions
router.get("/projects/:id/website-versions", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.userId;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const history = (project.websiteVersionHistory as WebsiteVersion[] | null) ?? [];
  // Return metadata only (not full websiteOutput) for the list
  const versions = history.map(({ id, savedAt, label }) => ({ id, savedAt, label }));
  res.json({ versions });
});

// POST /api/projects/:id/website-versions/:versionId/restore — restore a version
router.post("/projects/:id/website-versions/:versionId/restore", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const versionId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;
  const userId = req.user!.userId;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const history = (project.websiteVersionHistory as WebsiteVersion[] | null) ?? [];
  const version = history.find(v => v.id === versionId);
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  // Push current websiteOutput to history before restoring
  let newHistory = history.filter(v => v.id !== versionId);
  if (project.websiteOutput) {
    const snapshot: WebsiteVersion = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      label: `Version ${newHistory.length + 1}`,
      websiteOutput: project.websiteOutput as Record<string, unknown>,
    };
    newHistory = [snapshot, ...newHistory].slice(0, MAX_VERSIONS);
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ websiteOutput: version.websiteOutput, websiteVersionHistory: newHistory })
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
    .returning();

  res.json({ project: updated, restoredOutput: version.websiteOutput });
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.userId;
  await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  res.json({ ok: true });
});

export default router;
