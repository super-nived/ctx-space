import { cn } from '@/lib/cn';
import type { PreviewStatus } from '@/features/preview/useLivePreview';
import { useProjectStore } from '@/store/projectStore';
import { useAgentStatus } from '@/features/agent/useAgentStatus';

interface PreviewPanelProps {
  srcDoc: string | null;
  status: PreviewStatus;
}

function BuildingSkeleton({ fileName }: { fileName: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="building-ring flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--indigo-lt)' }}>
        <svg className="h-7 w-7" style={{ color: 'var(--indigo)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {fileName ? `Writing ${fileName}…` : 'Building your app…'}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          Preview will appear as files are written
        </p>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {[80, 55, 70, 45, 65, 40].map((w, i) => (
          <div key={i} className="shimmer-row h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}

/** Fake browser chrome bar — matches Lovable's preview window style */
function BrowserBar({ isRunning, lastWrittenFile }: { isRunning: boolean; lastWrittenFile: string | null }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
    >
      {/* Traffic lights */}
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--border)' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--border)' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--border)' }} />
      </div>

      {/* URL bar */}
      <div
        className="flex flex-1 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px]"
        style={{ background: 'var(--surface-3)', color: 'var(--ink-muted)' }}
      >
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--ink-muted)' }}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a.75.75 0 0 0 0 1.5c.966 0 1.75.784 1.75 1.75S8.966 9.5 8 9.5a.75.75 0 0 0 0 1.5 3.25 3.25 0 1 0 0-6.5z" />
        </svg>
        <span className="truncate">localhost · preview</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 shrink-0" style={{ color: 'var(--indigo)' }}>
            <span className="dot-1 inline-block h-1 w-1 rounded-full" style={{ background: 'var(--indigo)' }} />
            <span className="dot-2 inline-block h-1 w-1 rounded-full" style={{ background: 'var(--indigo)' }} />
            <span className="dot-3 inline-block h-1 w-1 rounded-full" style={{ background: 'var(--indigo)' }} />
            {lastWrittenFile && (
              <span className="ml-0.5 text-[10px]">{lastWrittenFile.split('/').pop()}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export function PreviewPanel({ srcDoc, status }: PreviewPanelProps) {
  const device = useProjectStore((s) => s.device);
  const previewError = useProjectStore((s) => s.previewError);
  const { isRunning, lastWrittenFile } = useAgentStatus();

  const showSkeleton = !srcDoc && isRunning;
  const showEmptyState = !srcDoc && !isRunning;

  return (
    <div
      className="flex h-full min-h-0 items-start justify-center overflow-auto p-4"
      style={{ background: 'var(--canvas)' }}
    >
      <div
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-xl border transition-all',
          device === 'mobile' ? 'w-[390px]' : 'w-full',
          isRunning && srcDoc && 'ring-1',
        )}
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          ...(isRunning && srcDoc ? { '--tw-ring-color': 'var(--indigo)', boxShadow: '0 0 0 1px var(--indigo)' } as React.CSSProperties : {}),
        }}
      >
        {/* Browser chrome bar — always shown when there's content */}
        {(srcDoc || showSkeleton || showEmptyState) && (
          <BrowserBar isRunning={isRunning} lastWrittenFile={lastWrittenFile} />
        )}

        <div className="min-h-0 flex-1" style={{ background: 'var(--surface)' }}>
          {srcDoc ? (
            <iframe
              title="App preview"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              className="h-full w-full border-0"
            />
          ) : showSkeleton ? (
            <BuildingSkeleton fileName={lastWrittenFile} />
          ) : showEmptyState ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: 'var(--surface-2)' }}>
                  <svg className="h-6 w-6" style={{ color: 'var(--ink-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909" />
                  </svg>
                </div>
                <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                  Your app preview will appear here as the agent builds it.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>Building preview…</p>
            </div>
          )}
        </div>

        {status === 'error' && previewError && (
          <div
            className="absolute inset-x-0 bottom-0 max-h-40 overflow-auto border-t p-2.5 text-[12px]"
            style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Preview error</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(previewError.message)}
                className="rounded border px-1.5 py-0.5 text-[11px]"
                style={{ borderColor: 'rgba(239,68,68,0.4)' }}
              >
                Copy
              </button>
            </div>
            <pre className="font-mono whitespace-pre-wrap">{previewError.message}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
