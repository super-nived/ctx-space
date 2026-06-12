import { useEffect, useRef, useState } from 'react';

import { Wordmark } from '@/components/Wordmark';
import {
  projectsApi,
  type ProjectSummary,
} from '@/features/projects/projectsApi';

const EXAMPLE_PROMPTS = [
  'a todo app with drag-and-drop',
  'a habit tracker dashboard',
  'a landing page for a SaaS',
  'a dashboard for my DataSpace records',
  'a Pomodoro timer',
  'a markdown notes app',
];

interface LandingScreenProps {
  onCreate: (prompt: string) => void;
  onOpenProject: (id: string) => Promise<void>;
}

function formatCost(usd: number): string {
  if (!usd || usd === 0) return '';
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(3)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Profile dropdown — shows account info + quick links. */
function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-indigo-600 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white ring-2 ring-transparent transition hover:ring-indigo-300"
        aria-label="Account menu"
      >
        N
      </button>

      {open && (
        <div className="border-border-subtle bg-canvas absolute right-0 top-10 z-50 w-56 rounded-xl border shadow-lg">
          <div className="border-border-subtle border-b px-4 py-3">
            <p className="text-ink text-sm font-medium">Nived</p>
            <p className="text-ink-muted text-xs">nived-c@industryapps.net</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              className="text-ink-soft hover:bg-surface-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
              onClick={() => setOpen(false)}
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5z"/>
              </svg>
              All Projects
            </button>
            <div className="border-border-subtle my-1 border-t" />
            <div className="px-3 py-2">
              <p className="text-ink-muted mb-1 text-[11px] font-medium uppercase tracking-wide">Pricing info</p>
              <p className="text-ink-muted text-[12px] leading-relaxed">
                GPT-5 · <span className="text-ink">$15</span>/1M in · <span className="text-ink">$60</span>/1M out
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Card for a recent project in the homepage grid. */
function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectSummary;
  onOpen: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const cost = project.token_usage?.cost_usd ?? 0;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onOpen(project.id).then(() => setBusy(false), () => setBusy(false));
      }}
      className="border-border-subtle bg-canvas hover:border-brand-300 hover:bg-surface group flex flex-col rounded-xl border p-4 text-left transition disabled:opacity-60"
    >
      {/* Colour thumbnail */}
      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 mb-3 flex h-28 w-full items-center justify-center rounded-lg">
        <svg className="text-indigo-300 h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </div>

      <p className="text-ink group-hover:text-brand-700 mb-1 truncate text-sm font-semibold transition">
        {busy ? 'Opening…' : project.name}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-ink-muted text-[11px]">{timeAgo(project.updated)}</p>
        {cost > 0 && (
          <span className="text-ink-muted bg-surface-2 rounded-full px-2 py-0.5 text-[10px] font-medium">
            {formatCost(cost)}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Landing / new-project screen — Lovable-style:
 * - Centered oversized prompt box
 * - Recent projects grid below
 * - Profile menu (top-right) with pricing info
 */
export function LandingScreen({ onCreate, onOpenProject }: LandingScreenProps) {
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    void projectsApi
      .list()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  const submit = () => {
    const trimmed = prompt.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <div className="bg-canvas flex min-h-full flex-col">
      {/* Top chrome */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Wordmark />
        <ProfileMenu />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-10">
        <div className="w-full max-w-2xl">
          <h1 className="text-ink text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to build?
          </h1>
          <p className="text-ink-soft mt-3 text-center text-[15px]">
            Describe an app and Context Space builds it live, powered by your agent.
          </p>

          {/* Prompt box */}
          <div className="border-border-subtle bg-canvas focus-within:border-brand-300 focus-within:ring-brand-50 mt-8 rounded-2xl border p-2 shadow-sm focus-within:ring-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              placeholder="e.g. A kanban board with drag-and-drop columns…"
              className="text-ink placeholder:text-ink-muted block w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-ink-muted text-xs">⌘↵ to create</span>
              <button
                type="button"
                onClick={submit}
                disabled={!prompt.trim()}
                className="bg-brand-600 enabled:hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>

          {/* Example chips */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="border-border-subtle bg-surface text-ink-soft hover:border-brand-300 hover:text-ink rounded-full border px-3.5 py-1.5 text-sm transition"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Recent projects */}
        <div className="mt-14 w-full max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-ink text-base font-semibold">Recent projects</h2>
            {projects.length > 0 && (
              <span className="text-ink-muted text-[13px]">{projects.length} saved</span>
            )}
          </div>

          {loadingProjects ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border-border-subtle h-48 animate-pulse rounded-xl border bg-gray-50" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="border-border-subtle rounded-xl border border-dashed py-12 text-center">
              <p className="text-ink-muted text-sm">No projects yet. Create one above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpenProject} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
