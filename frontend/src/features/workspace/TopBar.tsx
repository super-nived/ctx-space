import { useEffect, useRef, useState } from 'react';

import { Wordmark } from '@/components/Wordmark';
import { downloadProjectZip } from '@/features/projects/downloadZip';
import { projectsApi } from '@/features/projects/projectsApi';
import { useAgentStatus } from '@/features/agent/useAgentStatus';
import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

interface TopBarProps {
  onToggleMobileView?: () => void;
  mobileView?: 'chat' | 'output';
  onOpenHistory?: () => void;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Thin animated progress bar that runs across the top of the header while the agent is active. */
function AgentProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-indigo-100">
      <div className="agent-progress-bar absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-indigo-400 via-indigo-600 to-indigo-400" />
    </div>
  );
}

/** Status pill: Thinking / Writing / Ready. */
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
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
        isActive
          ? 'bg-indigo-50 text-indigo-700'
          : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {isActive ? (
        <span className="flex items-center gap-0.5">
          <span className="dot-1 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
          <span className="dot-2 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
          <span className="dot-3 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      )}
      {label}
    </div>
  );
}

/** Inline editable project name — click to edit, Enter/blur to save. */
function ProjectNameEditor() {
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectId = useSessionStore((s) => s.projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(projectName);
  }, [projectName]);

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
    if (projectId) {
      await projectsApi.update(projectId, { name: trimmed }).catch(() => {});
    }
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
        className="text-ink bg-surface-2 w-44 rounded-md px-2 py-0.5 text-sm font-medium outline-none ring-2 ring-indigo-400"
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
      className="text-ink hover:bg-surface-2 group flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium"
    >
      <span className="max-w-[180px] truncate">{projectName}</span>
      {/* pencil icon — only visible on hover */}
      <svg
        className="text-ink-muted h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a1.75 1.75 0 0 1-.72.439l-3.066.93a.75.75 0 0 1-.93-.93l.93-3.066a1.75 1.75 0 0 1 .439-.72l8.61-8.61z" />
      </svg>
    </button>
  );
}

/** Token usage + real cost pill. */
function UsageBadge() {
  const usage = useSessionStore((s) => s.tokenUsage);
  const total = usage.input_tokens + usage.output_tokens;
  if (total === 0) return null;

  return (
    <div
      title={`Input: ${usage.input_tokens.toLocaleString()} tokens ($${(usage.input_tokens / 1_000_000 * 15).toFixed(4)})\nOutput: ${usage.output_tokens.toLocaleString()} tokens ($${(usage.output_tokens / 1_000_000 * 60).toFixed(4)})\nModel: gpt-5  •  $15/1M in · $60/1M out`}
      className="border-border-subtle text-ink-muted flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
    >
      <svg className="h-3 w-3 text-amber-500" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.25H5.5a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 .75-.75V5.25z" />
      </svg>
      <span>{formatTokens(total)} tok</span>
      <span className="text-ink border-border-subtle border-l pl-1.5 font-semibold">{formatCost(usage.cost_usd)}</span>
    </div>
  );
}

/** Slim top bar with live agent status. */
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
    <header className="border-border-subtle bg-canvas relative flex h-12 shrink-0 items-center justify-between border-b px-3">
      {/* Animated progress bar along the bottom edge of the header */}
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
            className="border-border-subtle text-ink-soft mr-1 rounded-md border px-2.5 py-1 text-[13px] lg:hidden"
          >
            {mobileView === 'chat' ? 'Preview' : 'Chat'}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-ink-soft hover:bg-surface-2 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5zm0 5h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5z" />
          </svg>
          Projects
        </button>
        <button
          type="button"
          onClick={newProject}
          className="text-ink-soft hover:bg-surface-2 rounded-md px-2.5 py-1 text-[13px]"
        >
          New
        </button>
        <button
          type="button"
          onClick={downloadZip}
          disabled={!hasFiles}
          title={hasFiles ? 'Download project as .zip' : 'No files to download yet'}
          className="text-ink-soft hover:bg-surface-2 rounded-md px-2.5 py-1 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download
        </button>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
        >
          Publish
        </button>
      </div>
    </header>
  );
}
