import { useEffect, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

import { projectsApi, type ProjectSummary } from './projectsApi';

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  /** Loads a project's files + chat and continues editing it. */
  onOpenProject: (id: string) => Promise<void>;
}

/**
 * Slide-over panel listing all saved projects (newest first). Click one to open
 * its files + conversation and keep editing; create a new one without losing the
 * others. This is the Lovable-style project history.
 */
export function HistorySidebar({ open, onClose, onOpenProject }: HistorySidebarProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentProjectId = useSessionStore((s) => s.projectId);
  const resetProject = useProjectStore((s) => s.resetProject);
  const resetSession = useSessionStore((s) => s.reset);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const list = await projectsApi.list();
        if (active) setProjects(list);
      } catch {
        if (active) setProjects([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const handleOpen = async (id: string) => {
    setBusyId(id);
    try {
      await onOpenProject(id);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const handleNew = () => {
    resetProject();
    resetSession();
    window.location.reload();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project permanently?')) return;
    await projectsApi.remove(id).catch(() => {});
    setProjects((ps) => ps.filter((p) => p.id !== id));
    if (id === currentProjectId) handleNew();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside className="border-border-subtle bg-canvas fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r shadow-xl">
        <div className="border-border-subtle flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-ink text-sm font-semibold">Projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={handleNew}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-white"
          >
            + New project
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <p className="text-ink-muted px-2 py-3 text-[13px]">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-ink-muted px-2 py-3 text-[13px]">
              No saved projects yet. Build one and it'll appear here.
            </p>
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(p.id)}
                    disabled={busyId === p.id}
                    className={`group hover:bg-surface-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                      p.id === currentProjectId ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-[13px] font-medium">
                        {busyId === p.id ? 'Opening…' : p.name}
                      </span>
                      <span className="text-ink-muted block text-[11px]">
                        {new Date(p.updated).toLocaleString()}
                      </span>
                    </span>
                    <span
                      onClick={(e) => handleDelete(e, p.id)}
                      className="text-ink-muted ml-2 hidden rounded px-1.5 py-0.5 text-[11px] group-hover:inline hover:bg-red-100 hover:text-red-600"
                    >
                      Delete
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
