import { cn } from '@/lib/cn';
import type { PreviewStatus } from '@/features/preview/useLivePreview';
import { useProjectStore } from '@/store/projectStore';
import { useAgentStatus } from '@/features/agent/useAgentStatus';

interface PreviewPanelProps {
  srcDoc: string | null;
  status: PreviewStatus;
}

/** Skeleton shown while the agent is building and no preview exists yet. */
function BuildingSkeleton({ fileName }: { fileName: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      {/* Animated icon */}
      <div className="building-ring flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
        <svg className="h-7 w-7 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-ink text-sm font-medium">
          {fileName ? `Writing ${fileName}…` : 'Building your app…'}
        </p>
        <p className="text-ink-muted mt-1 text-[12px]">Preview will appear as files are written</p>
      </div>

      {/* Shimmer rows simulating code */}
      <div className="w-full max-w-xs space-y-2.5">
        {[80, 55, 70, 45, 65, 40].map((w, i) => (
          <div
            key={i}
            className="shimmer-row h-3 rounded-full"
            style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Live preview: a sandboxed iframe whose document is built in-browser
 * (esm.sh + Babel). Shows an animated building skeleton before the first
 * render; once the preview is live it pulses subtly while the agent keeps
 * writing (so the user knows more edits are in-flight).
 */
export function PreviewPanel({ srcDoc, status }: PreviewPanelProps) {
  const device = useProjectStore((s) => s.device);
  const previewError = useProjectStore((s) => s.previewError);
  const { isRunning, lastWrittenFile } = useAgentStatus();

  const showSkeleton = !srcDoc && isRunning;
  const showEmptyState = !srcDoc && !isRunning;

  return (
    <div className="bg-surface-2 flex h-full min-h-0 items-start justify-center overflow-auto p-4">
      <div
        className={cn(
          'border-border-subtle bg-canvas relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-all',
          device === 'mobile' ? 'w-[390px]' : 'w-full',
          // Subtle indigo ring while agent is actively editing the preview
          isRunning && srcDoc && 'ring-2 ring-indigo-200',
        )}
      >
        {/* Top bar ribbon while agent is running and preview is live */}
        {isRunning && srcDoc && (
          <div className="bg-indigo-50/80 border-border-subtle flex items-center gap-2 border-b px-3 py-1.5 backdrop-blur-sm">
            <span className="flex items-center gap-1">
              <span className="dot-1 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
              <span className="dot-2 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
              <span className="dot-3 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
            </span>
            <span className="text-indigo-700 text-[11px] font-medium">
              {lastWrittenFile
                ? `Updating ${lastWrittenFile.split('/').pop()}…`
                : 'Agent is editing…'}
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1">
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
                <div className="bg-surface-2 flex h-12 w-12 items-center justify-center rounded-xl">
                  <svg className="text-ink-muted h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909" />
                  </svg>
                </div>
                <p className="text-ink-muted text-[13px]">
                  Your app preview will appear here as the agent builds it.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <p className="text-ink-muted text-[13px]">Building preview…</p>
            </div>
          )}
        </div>

        {/* Non-blocking error ribbon */}
        {status === 'error' && previewError && (
          <div className="absolute inset-x-0 bottom-0 max-h-40 overflow-auto border-t border-red-200 bg-red-50 p-2.5 text-[12px] text-red-700">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Preview error</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(previewError.message)}
                className="rounded border border-red-300 px-1.5 py-0.5 text-[11px] hover:bg-red-100"
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
