import { cn } from '@/lib/cn';
import type { PreviewStatus } from '@/features/preview/useLivePreview';
import { useProjectStore } from '@/store/projectStore';

interface PreviewPanelProps {
  srcDoc: string | null;
  status: PreviewStatus;
}

/**
 * Live preview: a sandboxed iframe whose document is built in-browser
 * (esm.sh + Babel). Renders in ~1-2s. The device toggle sets the iframe
 * container width (390px mobile / full desktop).
 */
export function PreviewPanel({ srcDoc, status }: PreviewPanelProps) {
  const device = useProjectStore((s) => s.device);
  const previewError = useProjectStore((s) => s.previewError);

  return (
    <div className="bg-surface-2 flex h-full min-h-0 items-start justify-center overflow-auto p-4">
      <div
        className={cn(
          'border-border-subtle bg-canvas relative h-full overflow-hidden rounded-xl border shadow-sm transition-all',
          device === 'mobile' ? 'w-[390px]' : 'w-full',
        )}
      >
        {srcDoc ? (
          <iframe
            title="App preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <p className="text-ink-muted text-[13px]">
              {status === 'building'
                ? 'Building preview…'
                : 'Your app preview will appear here as the agent builds it.'}
            </p>
          </div>
        )}

        {/* Non-blocking error ribbon (preview keeps last-good render underneath). */}
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
