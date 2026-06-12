/**
 * Client for the FastAPI project-storage proxy (which talks to PocketBase).
 * Projects persist across refresh AND devices; the History sidebar uses this to
 * list and load past projects.
 */

// FastAPI base URL. In dev the agent runs at :8000; reuse that origin.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export interface ProjectSummary {
  id: string;
  name: string;
  thread_id?: string;
  updated: string;
  created: string;
}

export interface ProjectFull extends ProjectSummary {
  files: Record<string, string>;
  messages: unknown[];
  preview_entry?: string;
}

export interface ProjectUpsert {
  name?: string;
  files?: Record<string, string>;
  messages?: unknown[];
  thread_id?: string;
  preview_entry?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const projectsApi = {
  list: () => fetch(`${API_BASE}/api/projects`).then((r) => json<ProjectSummary[]>(r)),

  get: (id: string) =>
    fetch(`${API_BASE}/api/projects/${id}`).then((r) => json<ProjectFull>(r)),

  create: (data: ProjectUpsert) =>
    fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<ProjectFull>(r)),

  update: (id: string, data: ProjectUpsert) =>
    fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<ProjectFull>(r)),

  remove: (id: string) =>
    fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' }).then((r) =>
      json<{ deleted: string }>(r),
    ),
};
