import { useEffect, useState } from 'react';

import { useAgentStatus } from '@/features/agent/useAgentStatus';
import { useLivePreview } from '@/features/preview/useLivePreview';
import { cn } from '@/lib/cn';
import { useProjectStore } from '@/store/projectStore';

import { CodeViewer } from './CodeViewer';
import { PreviewPanel } from './PreviewPanel';

/** Right pane: Preview | Code tabs with toolbar and live agent status. */
export function OutputPanel() {
  const outputTab = useProjectStore((s) => s.outputTab);
  const setOutputTab = useProjectStore((s) => s.setOutputTab);
  const device = useProjectStore((s) => s.device);
  const setDevice = useProjectStore((s) => s.setDevice);
  const files = useProjectStore((s) => s.files);

  const { isRunning, phase } = useAgentStatus();

  // Count files written this session so we can show "5 files" badge.
  const [filesWritten, setFilesWritten] = useState(0);
  const fileCount = Object.keys(files).length;
  useEffect(() => {
    if (isRunning) setFilesWritten(fileCount);
  }, [isRunning, fileCount]);

  // Build the preview at this level so it survives Preview<->Code switches.
  const { status, srcDoc } = useLivePreview();

  // Auto-switch to preview tab once the first srcDoc arrives.
  useEffect(() => {
    if (srcDoc && outputTab === 'code') setOutputTab('preview');
  }, [srcDoc !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="bg-canvas flex h-full min-h-0 flex-col">
      {/* Tab bar + toolbar */}
      <div
        className={cn(
          'border-border-subtle flex items-center justify-between border-b px-3 py-2 transition-colors',
          isRunning && 'bg-indigo-50/40',
        )}
      >
        <div className="flex items-center gap-2">
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

          {/* File count badge while agent is running */}
          {isRunning && filesWritten > 0 && (
            <span className="text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5 text-[11px] font-medium">
              {filesWritten} {filesWritten === 1 ? 'file' : 'files'}
            </span>
          )}

          {/* Phase label */}
          {phase === 'ready' && fileCount > 0 && (
            <span className="text-emerald-600 flex items-center gap-1 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              Live
            </span>
          )}
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
                  title={mode === 'desktop' ? 'Desktop view' : 'Mobile view'}
                >
                  {mode === 'desktop' ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
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
