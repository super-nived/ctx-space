import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

type Phase = 'idle' | 'pushing' | 'done' | 'error';

interface PublishModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function PublishModal({ projectId, projectName, onClose }: PublishModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const publish = async () => {
    setPhase('pushing');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/publish`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? 'Publish failed');
      }
      const data = await res.json();
      setRepoUrl(data.repo_url ?? data.html_url ?? '');
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('error');
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(repoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={phase === 'pushing' ? undefined : onClose}
      />

      {/* Modal */}
      <div
        className="fade-in fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              Push to GitHub
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              {projectName}
            </p>
          </div>
          {phase !== 'pushing' && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/5"
              style={{ color: 'var(--ink-muted)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* idle state */}
        {phase === 'idle' && (
          <>
            <div
              className="mb-5 flex items-start gap-3 rounded-xl border p-4 text-[13px]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--indigo)' }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <div>
                All generated files will be pushed to a new repository on your GitHub account. The repo will be public.
              </div>
            </div>
            <button
              type="button"
              onClick={publish}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
            >
              Push to GitHub
            </button>
          </>
        )}

        {/* pushing state */}
        {phase === 'pushing' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative h-12 w-12">
              <div
                className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--indigo)' }}
              />
              <svg className="absolute inset-0 m-auto h-5 w-5" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--indigo)' }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>Pushing to GitHub…</p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>Creating repo and committing files</p>
            </div>
          </div>
        )}

        {/* done state */}
        {phase === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--emerald-lt)' }}>
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--emerald)' }}>
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Pushed successfully</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Your code is now on GitHub</p>
              </div>
            </div>

            {/* Repo URL */}
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--ink-muted)' }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                {repoUrl.replace('https://', '')}
              </span>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
                style={{ color: copied ? 'var(--emerald)' : 'var(--indigo)' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex gap-2">
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-500"
              >
                View on GitHub
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" />
                </svg>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 text-[13px] transition hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* error state */}
        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl border p-3 text-[13px]"
              style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              {error}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPhase('idle')}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-500"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 text-[13px] transition hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
