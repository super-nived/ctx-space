import { useLivePreview } from '@/features/preview/useLivePreview';
import { cn } from '@/lib/cn';
import { useProjectStore } from '@/store/projectStore';

import { CodeViewer } from './CodeViewer';
import { PreviewPanel } from './PreviewPanel';

/** Right pane: Preview | Code tabs with a toolbar (device toggle, refresh). */
export function OutputPanel() {
  const outputTab = useProjectStore((s) => s.outputTab);
  const setOutputTab = useProjectStore((s) => s.setOutputTab);
  const device = useProjectStore((s) => s.device);
  const setDevice = useProjectStore((s) => s.setDevice);

  // Build the preview at this level so it survives Preview<->Code switches.
  const { status, srcDoc } = useLivePreview();

  return (
    <section className="bg-canvas flex h-full min-h-0 flex-col">
      {/* Tab bar + toolbar */}
      <div className="border-border-subtle flex items-center justify-between border-b px-3 py-2">
        <div className="bg-surface-2 flex items-center gap-1 rounded-lg p-0.5">
          {(['preview', 'code'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOutputTab(tab)}
              className={cn(
                'rounded-md px-3 py-1 text-[13px] font-medium capitalize transition',
                outputTab === tab
                  ? 'bg-canvas text-ink shadow-sm'
                  : 'text-ink-soft hover:text-ink',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {outputTab === 'preview' && (
          <div className="flex items-center gap-1">
            <div className="bg-surface-2 flex items-center gap-0.5 rounded-lg p-0.5">
              {(['desktop', 'mobile'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDevice(mode)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[12px] transition',
                    device === mode
                      ? 'bg-canvas text-ink shadow-sm'
                      : 'text-ink-soft hover:text-ink',
                  )}
                  aria-pressed={device === mode}
                >
                  {mode === 'desktop' ? '🖥' : '📱'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-ink-soft hover:bg-surface-2 rounded-md px-2 py-1 text-[13px]"
              title="Refresh preview"
            >
              ↻
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {/* Keep PreviewPanel mounted (just hidden) so the iframe/HMR persists. */}
        <div className={cn('h-full', outputTab === 'preview' ? 'block' : 'hidden')}>
          <PreviewPanel srcDoc={srcDoc} status={status} />
        </div>
        <div className={cn('h-full', outputTab === 'code' ? 'block' : 'hidden')}>
          <CodeViewer />
        </div>
      </div>
    </section>
  );
}
