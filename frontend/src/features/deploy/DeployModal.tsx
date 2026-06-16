import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

type Phase = 'idle' | 'deploying' | 'done' | 'error';
type Target = 'netlify' | 'render' | 'both';

interface DeployResult {
  netlify?: { deploy_url: string; site_url: string };
  render?: { service_url: string };
}

interface DeployModalProps {
  projectId: string;
  projectName: string;
  hasMiddleware: boolean;   // true if project has FastAPI files → show Render option
  githubUrl?: string;       // set if project has been published
  onClose: () => void;
}

export function DeployModal({
  projectId,
  projectName,
  hasMiddleware,
  githubUrl,
  onClose,
}: DeployModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<Target>('netlify');
  const [result, setResult] = useState<DeployResult>({});
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const deploy = async () => {
    setPhase('deploying');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? 'Deploy failed');
      }
      setResult(await res.json());
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('error');
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Netlify builds server-side from the project's saved files — no GitHub
  // needed. Only Render (and "both") deploys from the GitHub repo.
  const needsGithub = !githubUrl && (target === 'render' || target === 'both');

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={phase === 'deploying' ? undefined : onClose}
      />
      <div
        className="fade-in fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              Deploy
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              {projectName}
            </p>
          </div>
          {phase !== 'deploying' && (
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

        {/* Idle */}
        {phase === 'idle' && (
          <>
            {/* Target selector */}
            <div className="mb-4">
              <p className="mb-2 text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                Deploy target
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: 'netlify', label: 'Frontend only', sub: 'Build here → deploy to Netlify' },
                    ...(hasMiddleware
                      ? [
                          {
                            value: 'render',
                            label: 'Middleware only',
                            sub: 'GitHub → Render build',
                          },
                          {
                            value: 'both',
                            label: 'Frontend + Middleware',
                            sub: 'Netlify + Render',
                          },
                        ]
                      : []),
                  ] as { value: Target; label: string; sub: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition"
                    style={{
                      borderColor: target === opt.value ? 'var(--indigo)' : 'var(--border)',
                      background: target === opt.value ? 'rgba(99,102,241,0.08)' : 'var(--surface-2)',
                    }}
                  >
                    <input
                      type="radio"
                      name="target"
                      value={opt.value}
                      checked={target === opt.value}
                      onChange={() => setTarget(opt.value)}
                      className="accent-indigo-500"
                    />
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                        {opt.label}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {opt.sub}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Warning: deploys need GitHub */}
            {needsGithub && (
              <div
                className="mb-4 rounded-xl border p-3 text-[12px]"
                style={{
                  background: 'rgba(234,179,8,0.08)',
                  borderColor: 'rgba(234,179,8,0.3)',
                  color: '#fbbf24',
                }}
              >
                Render deploys from GitHub. Click <strong>Publish</strong> first to push your code to a repo.
              </div>
            )}

            <button
              type="button"
              onClick={deploy}
              disabled={needsGithub}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deploy
            </button>
          </>
        )}

        {/* Deploying */}
        {phase === 'deploying' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative h-12 w-12">
              <div
                className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--indigo)' }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-lg">🚀</span>
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                Deploying…
              </p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                {target === 'netlify' && 'Building with Vite and deploying to Netlify'}
                {target === 'render' && 'Creating Render web service from GitHub repo'}
                {target === 'both' && 'Deploying to Netlify and Render'}
              </p>
            </div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--emerald-lt)' }}
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--emerald)' }}>
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                Deployed successfully
              </p>
            </div>

            {result.netlify && (
              <UrlRow
                label="Netlify"
                url={result.netlify.site_url || result.netlify.deploy_url}
                copyKey="netlify"
                copied={copied}
                onCopy={copy}
              />
            )}
            {result.render && (
              <UrlRow
                label="Render"
                url={result.render.service_url}
                copyKey="render"
                copied={copied}
                onCopy={copy}
              />
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-1 w-full rounded-xl border py-2.5 text-[13px] transition hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
            >
              Done
            </button>
          </div>
        )}

        {/* Error */}
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

function UrlRow({
  label,
  url,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </p>
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>
          {url.replace('https://', '')}
        </span>
        <button
          type="button"
          onClick={() => onCopy(url, copyKey)}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
          style={{ color: copied === copyKey ? 'var(--emerald)' : 'var(--indigo)' }}
        >
          {copied === copyKey ? 'Copied!' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
          style={{ color: 'var(--indigo)' }}
        >
          Open ↗
        </a>
      </div>
    </div>
  );
}
