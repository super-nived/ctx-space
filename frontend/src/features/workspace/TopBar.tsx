import { useEffect, useRef, useState } from 'react';

import { Wordmark } from '@/components/Wordmark';
import { downloadProjectZip } from '@/features/projects/downloadZip';
import { projectsApi } from '@/features/projects/projectsApi';
import { useAgentStatus } from '@/features/agent/useAgentStatus';
import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeStore, resolveIsDark } from '@/store/themeStore';

interface TopBarProps {
  onToggleMobileView?: () => void;
  mobileView?: 'chat' | 'output';
  onOpenHistory?: () => void;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const isDark = resolveIsDark(theme);
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid h-7 w-7 place-items-center rounded-lg transition-colors"
      style={{ background: 'var(--surface-2)', color: isDark ? '#fbbf24' : '#6366f1' }}
      aria-label="Toggle theme"
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.172 18.894a.75.75 0 1 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591ZM5.25 12a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 1 0-1.5H4.5a.75.75 0 0 1 .75.75ZM6.166 6.166a.75.75 0 0 0-1.06 1.06l1.59 1.591a.75.75 0 1 0 1.061-1.06L6.166 6.166Z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

function AgentProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
      <div className="agent-progress-bar absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400" />
    </div>
  );
}

function StatusPill({ phase, lastWrittenFile }: { phase: string; lastWrittenFile: string | null }) {
  if (phase === 'idle') return null;

  const label =
    phase === 'building' && lastWrittenFile
      ? `Writing ${lastWrittenFile.split('/').pop()}`
      : phase === 'building'
        ? 'Building…'
        : phase === 'thinking'
          ? 'Thinking…'
          : phase === 'ready'
            ? 'Ready'
            : null;

  if (!label) return null;

  const isActive = phase === 'building' || phase === 'thinking';

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
      style={
        isActive
          ? { background: 'var(--indigo-lt)', color: 'var(--indigo)' }
          : { background: 'var(--emerald-lt)', color: 'var(--emerald)' }
      }
    >
      {isActive ? (
        <span className="flex items-center gap-0.5">
          <span className="dot-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
          <span className="dot-2 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
          <span className="dot-3 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
        </span>
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--emerald)' }} />
      )}
      {label}
    </div>
  );
}

function ProjectNameEditor() {
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectId = useSessionStore((s) => s.projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(projectName); }, [projectName]);

  const startEdit = () => {
    setDraft(projectName);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim() || 'Untitled';
    if (trimmed === projectName) return;
    setProjectName(trimmed);
    if (projectId) await projectsApi.update(projectId, { name: trimmed }).catch(() => {});
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') { setDraft(projectName); setEditing(false); }
        }}
        className="w-44 rounded-md px-2 py-0.5 text-sm font-medium outline-none ring-2 ring-indigo-400"
        style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
        maxLength={60}
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to rename"
      className="group flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition hover:bg-white/5"
      style={{ color: 'var(--ink)' }}
    >
      <span className="max-w-[180px] truncate">{projectName}</span>
      <svg className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" style={{ color: 'var(--ink-muted)' }} viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a1.75 1.75 0 0 1-.72.439l-3.066.93a.75.75 0 0 1-.93-.93l.93-3.066a1.75 1.75 0 0 1 .439-.72l8.61-8.61z" />
      </svg>
    </button>
  );
}

function UsageBadge() {
  const usage = useSessionStore((s) => s.tokenUsage);
  const total = usage.input_tokens + usage.output_tokens;
  if (total === 0) return null;

  return (
    <div
      title={`Input: ${usage.input_tokens.toLocaleString()} tokens ($${(usage.input_tokens / 1_000_000 * 15).toFixed(4)})\nOutput: ${usage.output_tokens.toLocaleString()} tokens ($${(usage.output_tokens / 1_000_000 * 60).toFixed(4)})\nModel: gpt-5  •  $15/1M in · $60/1M out`}
      className="flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
    >
      <svg className="h-3 w-3 text-amber-400" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.25H5.5a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 .75-.75V5.25z" />
      </svg>
      <span>{formatTokens(total)} tok</span>
      <span className="border-l pl-1.5 font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
        {formatCost(usage.cost_usd)}
      </span>
    </div>
  );
}

export function TopBar({ onToggleMobileView, mobileView, onOpenHistory }: TopBarProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const files = useProjectStore((s) => s.files);
  const resetProject = useProjectStore((s) => s.resetProject);
  const resetSession = useSessionStore((s) => s.reset);
  const { isRunning, phase, lastWrittenFile } = useAgentStatus();

  const hasFiles = Object.keys(files).length > 0;
  const downloadZip = () => downloadProjectZip(projectName, files);

  const newProject = () => {
    if (!confirm('Start a new project? The current one is saved and will appear in your History.')) return;
    resetProject();
    resetSession();
    window.location.reload();
  };

  return (
    <header
      className="relative flex h-12 shrink-0 items-center justify-between border-b px-3"
      style={{ background: 'var(--canvas)', borderColor: 'var(--border)' }}
    >
      <AgentProgressBar visible={isRunning} />

      <div className="flex items-center gap-2">
        <Wordmark showFull={false} />
        <ProjectNameEditor />
        <StatusPill phase={phase} lastWrittenFile={lastWrittenFile} />
        <UsageBadge />
      </div>

      <div className="flex items-center gap-1">
        {onToggleMobileView && (
          <button
            type="button"
            onClick={onToggleMobileView}
            className="mr-1 rounded-md border px-2.5 py-1 text-[13px] lg:hidden"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
          >
            {mobileView === 'chat' ? 'Preview' : 'Chat'}
          </button>
        )}
        <ThemeToggle />
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition hover:bg-white/5"
          style={{ color: 'var(--ink-soft)' }}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5z" />
          </svg>
          Projects
        </button>
        <button
          type="button"
          onClick={newProject}
          className="rounded-md px-2.5 py-1 text-[13px] transition hover:bg-white/5"
          style={{ color: 'var(--ink-soft)' }}
        >
          New
        </button>
        <button
          type="button"
          onClick={downloadZip}
          disabled={!hasFiles}
          title={hasFiles ? 'Download project as .zip' : 'No files to download yet'}
          className="rounded-md px-2.5 py-1 text-[13px] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: 'var(--ink-soft)' }}
        >
          Download
        </button>
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-500"
        >
          Publish
        </button>
      </div>
    </header>
  );
}
