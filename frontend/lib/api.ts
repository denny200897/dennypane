"use client";

const TOKEN_KEY = "dennypanel_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (opts.body && !(opts.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    clearToken();
    if (!location.pathname.startsWith("/login")) location.href = "/login";
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async login(username: string, password: string) {
    const body = new URLSearchParams({ username, password });
    const res = await fetch("/api/auth/login", { method: "POST", body });
    if (!res.ok) throw new ApiError(res.status, "Incorrect username or password");
    const data = await res.json();
    setToken(data.access_token);
    return data;
  },
  me: () => request<{ id: number; username: string; is_admin: boolean }>("/auth/me"),
  systemOverview: () => request<any>("/system/overview"),
  processes: (limit = 8) => request<any[]>(`/system/processes?limit=${limit}`),
  containers: () => request<any[]>("/docker/containers?all=true"),
  containerAction: (id: string, action: string) =>
    request(`/docker/containers/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  containerLogs: (id: string) => request<{ logs: string }>(`/docker/containers/${id}/logs`),
  dockerSummary: () =>
    request<{
      containers_total: number;
      containers_running: number;
      containers_stopped: number;
      images: number;
    }>("/docker/summary"),
  runContainer: (payload: {
    image: string;
    name?: string | null;
    ports?: Record<string, number>;
    env?: Record<string, string>;
    volumes?: Record<string, string>;
    restart?: string;
  }) => request("/docker/containers", { method: "POST", body: JSON.stringify(payload) }),
  images: () => request<any[]>("/docker/images"),
  sites: () => request<any[]>("/sites"),
  createSite: (payload: any) =>
    request("/sites", { method: "POST", body: JSON.stringify(payload) }),
  deleteSite: (id: number) => request(`/sites/${id}`, { method: "DELETE" }),
  sshHosts: () => request<any[]>("/ssh/hosts"),
  createSshHost: (payload: any) =>
    request("/ssh/hosts", { method: "POST", body: JSON.stringify(payload) }),
  deleteSshHost: (id: number) => request(`/ssh/hosts/${id}`, { method: "DELETE" }),
  sshExec: (id: number, command: string) =>
    request<{ exit_code: number; stdout: string; stderr: string }>(`/ssh/hosts/${id}/exec`, {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  applyProxy: (id: number, payload: { enable_ssl: boolean; email?: string | null }) =>
    request(`/sites/${id}/proxy`, { method: "POST", body: JSON.stringify(payload) }),

  // Files
  listFiles: (path = "") =>
    request<{ path: string; entries: any[] }>(`/files/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) =>
    request<{ path: string; content: string }>(`/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    request(`/files/write`, { method: "POST", body: JSON.stringify({ path, content }) }),
  mkdir: (path: string) => request(`/files/mkdir`, { method: "POST", body: JSON.stringify({ path }) }),
  deletePath: (path: string) =>
    request(`/files/delete`, { method: "POST", body: JSON.stringify({ path }) }),

  // FTP
  ftpAccounts: () => request<any[]>("/ftp/accounts"),
  createFtpAccount: (payload: any) =>
    request("/ftp/accounts", { method: "POST", body: JSON.stringify(payload) }),
  deleteFtpAccount: (id: number) => request(`/ftp/accounts/${id}`, { method: "DELETE" }),

  // Cron
  cronJobs: () => request<any[]>("/cron/jobs"),
  addCronJob: (payload: any) =>
    request("/cron/jobs", { method: "POST", body: JSON.stringify(payload) }),
  removeCronJob: (label: string) =>
    request(`/cron/jobs/${encodeURIComponent(label)}`, { method: "DELETE" }),

  // Databases
  dbServers: () => request<any[]>("/databases/servers"),
  dbDatabases: (id: string) =>
    request<{ engine: string; databases: string[] }>(`/databases/servers/${id}/databases`),
};
