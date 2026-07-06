import { getActiveImpersonationToken } from "./impersonation-context";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const impersonationToken = getActiveImpersonationToken();
  const extraHeaders: Record<string, string> = {};
  if (impersonationToken) {
    extraHeaders["X-Impersonation-Token"] = impersonationToken;
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...extraHeaders, ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface ProjectEvent {
  type: string;
  label: string;
  timestamp: string;
}

export type ProjectType =
  | "business_intelligence"
  | "website"
  | "chatbot"
  | "automation"
  | "orchestration";

export interface Project {
  id: string;
  userId: string;
  title: string;
  businessIdea: string;
  type: ProjectType;
  status: string;
  output: Record<string, unknown> | null;
  websiteOutput: Record<string, unknown> | null;
  chatbotOutput: Record<string, unknown> | null;
  automationOutput: Record<string, unknown> | null;
  orchestratorOutput: Record<string, unknown> | null;
  projectEvents: ProjectEvent[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedIntegration {
  id: string;
  userId: string;
  provider: string;
  displayName: string;
  status: string;
  config: Record<string, unknown>;
  connectedAt: string;
  updatedAt: string;
}

export const api = {
  auth: {
    signup: (email: string, password: string, name: string) =>
      request<{ user: UserInfo }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ user: UserInfo }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    me: () => request<{ user: UserInfo }>("/auth/me"),
  },
  projects: {
    list: () => request<{ projects: Project[] }>("/projects"),
    get: (id: string) => request<{ project: Project }>(`/projects/${id}`),
    create: (data: { title: string; businessIdea: string; type?: ProjectType; status?: string; output?: unknown; websiteOutput?: unknown; chatbotOutput?: unknown; automationOutput?: unknown; orchestratorOutput?: unknown }) =>
      request<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { title?: string; status?: string; output?: unknown; websiteOutput?: unknown; chatbotOutput?: unknown; automationOutput?: unknown; orchestratorOutput?: unknown }) =>
      request<{ project: Project }>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetch(`${BASE}/projects/${id}`, { method: "DELETE", credentials: "include" }),
  },
  integrations: {
    list: () => request<{ integrations: ConnectedIntegration[] }>("/integrations"),
    connect: (provider: string, displayName: string, config?: Record<string, unknown>) =>
      request<{ integration: ConnectedIntegration }>("/integrations", {
        method: "POST",
        body: JSON.stringify({ provider, displayName, config }),
      }),
    disconnect: (provider: string) =>
      fetch(`${BASE}/integrations/${encodeURIComponent(provider)}`, {
        method: "DELETE",
        credentials: "include",
      }),
  },
  support: {
    listTickets: () =>
      request<{ tickets: Array<Record<string, unknown>> }>("/support/tickets"),
    createTicket: (data: { subject: string; category: string; priority: string; message: string }) =>
      request<{ ticket: Record<string, unknown> }>("/support/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getTicket: (id: string) =>
      request<{ ticket: Record<string, unknown>; messages: Array<Record<string, unknown>>; owner: unknown; assignedAdmin: unknown }>(`/support/tickets/${id}`),
    replyToTicket: (id: string, message: string) =>
      request<{ message: Record<string, unknown> }>(`/support/tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  },
  onboarding: {
    getProgress: () =>
      request<{ progress: { id: string; isDismissed: boolean; steps: Array<{ key: string; completed: boolean }> } }>("/onboarding"),
    completeStep: (step: "first_bi_generation" | "first_website" | "install_agent" | "chat_with_marcus" | "first_project_saved") =>
      request<{ progress: unknown }>("/onboarding/step", {
        method: "POST",
        body: JSON.stringify({ step }),
      }),
    dismiss: () =>
      request<{ progress: unknown }>("/onboarding/dismiss", { method: "POST" }),
  },
  referrals: {
    getMyLink: () =>
      request<{ referralCode: string; referralLink: string; referralCount: number; totalBonusGenerations: number }>("/referrals/me"),
  },
  websiteV2: {
    listProjects: () =>
      request<{ projects: Array<{ id: string; projectName: string; status: string; createdAt: string; updatedAt: string }> }>("/website-v2/projects"),
    getProject: (id: string) =>
      request<{
        id: string; projectName: string; status: string;
        businessContext: Record<string, unknown>;
        blueprint: Record<string, unknown> | null;
        files: Array<{ path: string; operation: string; content: string; language?: string }>;
        dependencies: string[];
        preview: string | null;
        createdAt: string; updatedAt: string;
      }>(`/website-v2/projects/${id}`),
  },
  admin: {
    getUsers: () => request<{ users: Array<UserInfo & { subscription: unknown }>, total: number }>("/admin/users"),
    updateUser: (id: string, data: { isAdmin?: boolean; name?: string }) =>
      request<{ user: UserInfo }>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateSubscription: (userId: string, plan: string) =>
      request<{ subscription: unknown }>(`/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      }),
    deleteUser: (id: string) =>
      request<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
    getStats: () =>
      request<{ totalUsers: number; admins: number; planCounts: Record<string, number>; totalGenerations: number }>("/admin/stats"),
  },
};
