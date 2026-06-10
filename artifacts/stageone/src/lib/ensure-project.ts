import { loadProjectContext, saveProjectContext } from "./generation-context";

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

  const projectTitle =
    title ?? (idea.length > 60 ? `${idea.slice(0, 60)}…` : idea);

  if (existingId) {
    console.log(
      `[ensureProject] type=${type} | projectId=${existingId} | saving ${outputField}`,
    );
    const saved = await patchProject(existingId, outputField, output);
    console.log(
      `[ensureProject] ${saved ? "saved" : "save failed"} — projectId=${existingId}`,
    );
    return { projectId: existingId, created: false, saved };
  }

  console.log(
    `[ensureProject] type=${type} | no projectId in sessionStorage — creating project`,
  );
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

    saveProjectContext({ projectId: newId, projectTitle });
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
