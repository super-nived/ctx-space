import { useEffect, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

import { projectsApi, type ProjectSummary } from './projectsApi';

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenProject: (id: string) => Promise<void>;
}

function formatCost(usd: number): string {
  if (!usd) return '';
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(3)}`;
}

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
    return () => { active = false; };
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
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} aria-hidden />
      <aside
        className="fade-in fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r shadow-2xl"
        style={{ background: 'var(--canvas)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-lg leading-none transition hover:bg-white/5"
            style={{ color: 'var(--ink-muted)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={handleNew}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-indigo-500"
          >
            + New project
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="space-y-1 px-1 pt-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shimmer-row h-12 rounded-lg" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="px-2 py-3 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              No saved projects yet. Build one and it'll appear here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const cost = (p.token_usage as { cost_usd?: number } | undefined)?.cost_usd ?? 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(p.id)}
                      disabled={busyId === p.id}
                      className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                      style={p.id === currentProjectId ? { background: 'var(--indigo-lt)' } : {}}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                          {busyId === p.id ? 'Opening…' : p.name}
                        </span>
                        <span className="block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {new Date(p.updated).toLocaleString()}
                        </span>
                      </span>
                      <div className="ml-2 flex items-center gap-1.5">
                        {cost > 0 && (
                          <span className="text-[10px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                            {formatCost(cost)}
                          </span>
                        )}
                        <span
                          onClick={(e) => handleDelete(e, p.id)}
                          className="hidden rounded px-1.5 py-0.5 text-[11px] transition group-hover:inline hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Delete
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
