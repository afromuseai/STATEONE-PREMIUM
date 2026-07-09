import { loadProjectContext, saveProjectContext, clearProjectContext } from "./generation-context";

export type ProjectType =
  | "business_intelligence"
  | "website"
  | "chatbot"
  | "automation"
  | "orchestration";

export type OutputField =
  | "output"
  | "websiteOutput"
  | "chatbotOutput"
  | "automationOutput"
  | "orchestratorOutput";

export interface EnsureProjectOptions {
  type: ProjectType;
  idea: string;
  outputField: OutputField;
  output: Record<string, unknown>;
  title?: string;
}

export interface EnsureProjectResult {
  projectId: string;
  created: boolean;
  saved: boolean;
}

async function patchProject(
  projectId: string,
  outputField: OutputField,
  output: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [outputField]: output }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`[ensureProject] PATCH failed ${res.status}`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[ensureProject] PATCH error", err);
    return false;
  }
}

export async function ensureProject(
  opts: EnsureProjectOptions,
): Promise<EnsureProjectResult> {
  const { type, idea, outputField, output, title } = opts;

  const ctx = loadProjectContext();
  const existingId = ctx?.projectId ?? null;
  const mode = ctx?.continuityMode ?? "standalone";
  const source = ctx?.source ?? "Standalone Generator";

  const projectTitle =
    title ?? (idea.length > 60 ? `${idea.slice(0, 60)}…` : idea);

  console.log(`ENSURE_PROJECT_INPUT | projectId=${existingId ?? "(none)"} | continuityMode=${mode} | source=${source} | type=${type}`);
  console.log(`PROJECT_ID_BEFORE: ${existingId ?? "(none)"}`);
  console.log(`PROJECT_MODE: ${mode}`);
  console.log(`PROJECT_SOURCE: ${source}`);

  if (existingId && mode === "continuation") {
    console.log(`ENSURE_PROJECT_DECISION | reuse=true | reason=existingId+continuation | projectId=${existingId}`);
    console.log(`PROJECT_REUSED | projectId=${existingId}`);
    console.log(`PROJECT_REUSE: true`);
    console.log(`PROJECT_CREATED: false`);
    const exists = await fetch(`/api/projects/${existingId}`, { method: "HEAD", credentials: "include" }).then(r => r.ok).catch(() => false)
    if (!exists) {
      console.log(`ENSURE_PROJECT_CONTINUATION_STALE | projectId=${existingId} — project no longer exists, falling through to create new`);
      clearProjectContext();
    } else {
      const saved = await patchProject(existingId, outputField, output);
      console.log(
        `[ensureProject] ${saved ? "saved" : "save failed"} — reusing projectId=${existingId} (continuation from ${source})`,
      );
      console.log(`PROJECT_ID_AFTER: ${existingId}`);
      return { projectId: existingId, created: false, saved };
    }
  }

  if (existingId) {
    console.log(`ENSURE_PROJECT_DECISION | reuse=false | reason=mode-not-continuation | mode=${mode} | projectId=${existingId}`);
    console.log(
      `PROJECT_REUSE: false (stale continuation discarded — mode=${mode}, existingId=${existingId})`,
    );
    clearProjectContext();
  } else {
    console.log(`ENSURE_PROJECT_DECISION | reuse=false | reason=no-prior-context`);
    console.log(`PROJECT_REUSE: false (no prior context in sessionStorage)`);
  }

  console.log(`PROJECT_CREATED: true — creating new standalone project (type=${type})`);
  try {
    const createRes = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: projectTitle,
        businessIdea: idea,
        type,
        status: "active",
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      console.error(`[ensureProject] POST failed ${createRes.status}`, body);
      return { projectId: "", created: false, saved: false };
    }
    const { project } = (await createRes.json()) as {
      project: { id: string; title: string };
    };
    const newId = project.id;

    console.log("[PROJECT_CREATED]", JSON.stringify({
      id: newId,
      title: projectTitle,
      type,
      timestamp: new Date().toISOString(),
    }))

    saveProjectContext({
      projectId: newId,
      projectTitle,
      continuityMode: "continuation",
      source: "Standalone Generator",
    });
    console.log(`PROJECT_ID_AFTER: ${newId}`);
    console.log(`[ensureProject] created project ${newId} (type=${type})`);

    const saved = await patchProject(newId, outputField, output);
    console.log(
      `[ensureProject] ${saved ? "saved" : "save failed"} — new projectId=${newId}`,
    );
    return { projectId: newId, created: true, saved };
  } catch (err) {
    console.error("[ensureProject] create error", err);
    return { projectId: "", created: false, saved: false };
  }
}
