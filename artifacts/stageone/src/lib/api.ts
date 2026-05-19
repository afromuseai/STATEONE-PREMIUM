const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
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

export interface Project {
  id: string;
  userId: string;
  title: string;
  businessIdea: string;
  status: string;
  output: Record<string, unknown> | null;
  websiteOutput: Record<string, unknown> | null;
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
    create: (data: { title: string; businessIdea: string; status?: string; output?: unknown; websiteOutput?: unknown }) =>
      request<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { title?: string; status?: string; output?: unknown; websiteOutput?: unknown }) =>
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
