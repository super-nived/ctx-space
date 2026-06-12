import { useEffect, useRef, useState } from 'react';

import { Wordmark } from '@/components/Wordmark';
import { projectsApi, type ProjectSummary } from '@/features/projects/projectsApi';
import { useThemeStore, resolveIsDark } from '@/store/themeStore';

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
  if (!usd) return '';
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

/** Sun/Moon toggle */
function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const isDark = resolveIsDark(theme);
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid h-8 w-8 place-items-center rounded-full transition-colors"
      style={{ background: 'rgba(255,255,255,0.08)', color: isDark ? '#fbbf24' : '#6366f1' }}
      aria-label="Toggle theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.172 18.894a.75.75 0 1 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591ZM5.25 12a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 1 0-1.5H4.5a.75.75 0 0 1 .75.75ZM6.166 6.166a.75.75 0 0 0-1.06 1.06l1.59 1.591a.75.75 0 1 0 1.061-1.06L6.166 6.166Z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

/** Profile avatar dropdown */
function ProfileMenu({ onOpenProjects }: { onOpenProjects: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-semibold text-white ring-2 ring-transparent transition hover:ring-indigo-400"
        aria-label="Account"
      >
        N
      </button>
      {open && (
        <div className="fade-in absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border shadow-2xl"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Nived</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>nived-c@industryapps.net</p>
          </div>
          <div className="p-1">
            <button type="button" onClick={() => { setOpen(false); onOpenProjects(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/5"
              style={{ color: 'var(--ink-soft)' }}>
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5z"/>
              </svg>
              All Projects
            </button>
          </div>
          <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-muted)' }}>Pricing</p>
            <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              GPT-5 · <span style={{ color: 'var(--ink)' }} className="font-medium">$15</span>/1M in
              · <span style={{ color: 'var(--ink)' }} className="font-medium">$60</span>/1M out
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Project card in the recent grid */
function ProjectCard({ project, onOpen }: { project: ProjectSummary; onOpen: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const cost = project.token_usage?.cost_usd ?? 0;

  // Pick a stable gradient per project based on its id
  const gradients = [
    'from-violet-500/20 to-indigo-500/20',
    'from-pink-500/20 to-rose-500/20',
    'from-cyan-500/20 to-blue-500/20',
    'from-amber-500/20 to-orange-500/20',
    'from-emerald-500/20 to-teal-500/20',
    'from-purple-500/20 to-pink-500/20',
  ];
  const grad = gradients[project.id.charCodeAt(0) % gradients.length];

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { setBusy(true); void onOpen(project.id).then(() => setBusy(false), () => setBusy(false)); }}
      className="group flex flex-col overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Thumbnail */}
      <div className={`bg-gradient-to-br ${grad} flex h-28 w-full items-center justify-center`}>
        <svg className="h-8 w-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--ink)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </div>
      <div className="p-3">
        <p className="mb-1 truncate text-[13px] font-semibold transition-colors group-hover:text-indigo-400" style={{ color: 'var(--ink)' }}>
          {busy ? 'Opening…' : project.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{timeAgo(project.updated)}</span>
          {cost > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
              {formatCost(cost)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function LandingScreen({ onCreate, onOpenProject }: LandingScreenProps) {
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void projectsApi.list().then(setProjects).catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  const submit = () => { const t = prompt.trim(); if (t) onCreate(t); };

  const visible = showAllProjects ? projects : projects.slice(0, 8);

  return (
    <div className="flex min-h-full flex-col" style={{ background: 'var(--canvas)' }}>
      {/* Gradient hero backdrop */}
      <div className="landing-gradient pointer-events-none absolute inset-0 z-0" />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <Wordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ProfileMenu onOpenProjects={() => setShowAllProjects(true)} />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {/* Hero headline */}
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-[2.6rem]"
            style={{ color: 'var(--ink)' }}>
            What do you want to{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
              build?
            </span>
          </h1>
          <p className="mt-3 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
            Describe an app and Context Space builds it live.
          </p>
        </div>

        {/* Prompt box — Lovable-style floating card */}
        <div className="mt-8 w-full max-w-2xl">
          <div
            className="overflow-hidden rounded-2xl border shadow-xl transition-shadow focus-within:shadow-2xl"
            style={{ background: 'var(--canvas)', borderColor: 'var(--border)' }}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
              rows={4}
              placeholder="Ask Lovable to build a web app that…"
              className="block w-full resize-none bg-transparent px-4 pt-4 text-[15px] outline-none placeholder:opacity-40"
              style={{ color: 'var(--ink)', caretColor: '#6366f1' }}
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-2">
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>⌘↵ to create</span>
              <button
                type="button"
                onClick={submit}
                disabled={!prompt.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.87 7.25a.75.75 0 0 0 0 1.5h8.69l-2.97 2.97a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06L9.65 3.22a.75.75 0 0 0-1.06 1.06l2.97 2.97H2.87Z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Example chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setPrompt(ex); textareaRef.current?.focus(); }}
                className="rounded-full border px-3 py-1.5 text-[12px] transition hover:border-indigo-400 hover:text-indigo-400"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)', background: 'rgba(255,255,255,0.03)' }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Recent projects */}
        <div className="mt-14 w-full max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              My projects
              {projects.length > 0 && (
                <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--ink-muted)' }}>
                  {projects.length}
                </span>
              )}
            </h2>
            {projects.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllProjects((v) => !v)}
                className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition"
              >
                {showAllProjects ? 'Show less' : 'Browse all'}
              </button>
            )}
          </div>

          {loadingProjects ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl"
                  style={{ background: 'var(--surface)' }} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center"
              style={{ borderColor: 'var(--border)' }}>
              <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                No projects yet — create one above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpenProject} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
