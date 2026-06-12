import { useEffect, useState } from 'react';

import { useAgentStatus } from '@/features/agent/useAgentStatus';
import { useLivePreview } from '@/features/preview/useLivePreview';
import { cn } from '@/lib/cn';
import { useProjectStore } from '@/store/projectStore';

import { CodeViewer } from './CodeViewer';
import { PreviewPanel } from './PreviewPanel';

export function OutputPanel() {
  const outputTab = useProjectStore((s) => s.outputTab);
  const setOutputTab = useProjectStore((s) => s.setOutputTab);
  const device = useProjectStore((s) => s.device);
  const setDevice = useProjectStore((s) => s.setDevice);
  const files = useProjectStore((s) => s.files);

  const { isRunning, phase } = useAgentStatus();

  const [filesWritten, setFilesWritten] = useState(0);
  const fileCount = Object.keys(files).length;
  useEffect(() => {
    if (isRunning) setFilesWritten(fileCount);
  }, [isRunning, fileCount]);

  const { status, srcDoc } = useLivePreview();

  useEffect(() => {
    if (srcDoc && outputTab === 'code') setOutputTab('preview');
  }, [srcDoc !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex h-full min-h-0 flex-col" style={{ background: 'var(--canvas)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center justify-between border-b px-3 py-2 transition-colors"
        style={{
          borderColor: 'var(--border)',
          background: isRunning ? 'rgba(99,102,241,0.06)' : 'var(--canvas)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
            {(['preview', 'code'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOutputTab(tab)}
                className="rounded-md px-3 py-1 text-[13px] font-medium capitalize transition"
                style={
                  outputTab === tab
                    ? { background: 'var(--canvas)', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
                    : { color: 'var(--ink-soft)' }
                }
              >
                {tab}
              </button>
            ))}
          </div>

          {isRunning && filesWritten > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--indigo-lt)', color: 'var(--indigo)' }}>
              {filesWritten} {filesWritten === 1 ? 'file' : 'files'}
            </span>
          )}

          {phase === 'ready' && fileCount > 0 && (
            <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--emerald)' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--emerald)' }} />
              Live
            </span>
          )}
        </div>

        {outputTab === 'preview' && (
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
            {(['desktop', 'mobile'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDevice(mode)}
                className="rounded-md px-2 py-1 text-[12px] transition"
                style={
                  device === mode
                    ? { background: 'var(--canvas)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }
                    : { color: 'var(--ink-soft)' }
                }
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
