/**
 * Drives the live preview using the in-browser esm.sh + Babel renderer
 * (buildPreviewHtml). Rebuilds the iframe document whenever files change —
 * debounced so a burst of writeFile calls produces one rebuild. Renders in
 * ~1-2s with no npm install. Runtime errors from the iframe are routed into the
 * store's previewError for the self-healing loop (P3b).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';
import type { ProjectFile } from '@/types/project';

import { buildPreviewHtml } from './buildPreviewHtml';

export type PreviewStatus = 'idle' | 'building' | 'ready' | 'error';

export function useLivePreview() {
  const files = useProjectStore((s) => s.files);
  const setPreviewError = useProjectStore((s) => s.setPreviewError);

  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileList: ProjectFile[] = useMemo(() => Object.values(files), [files]);

  // Listen for ready/error messages from the preview iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as
        | {
            __ctxPreviewReady?: boolean;
            __ctxPreviewError?: { message: string; line?: number };
          }
        | undefined;
      if (!data) return;
      if (data.__ctxPreviewReady) {
        setStatus('ready');
      } else if (data.__ctxPreviewError) {
        // Log the full error so it's always retrievable from the console.
        console.error('[ctx-preview] runtime error:', data.__ctxPreviewError.message);
        setStatus('error');
        setPreviewError({
          signature: `runtime:${data.__ctxPreviewError.message.slice(0, 120)}`,
          message: data.__ctxPreviewError.message,
          line: data.__ctxPreviewError.line,
          source: 'runtime',
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setPreviewError]);

  // Rebuild the preview document (debounced) when files change. State updates
  // happen inside the timer callback (not synchronously in the effect body) to
  // avoid cascading renders.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (fileList.length === 0) {
        setStatus('idle');
        setSrcDoc(null);
        return;
      }
      setStatus('building');
      const { html } = buildPreviewHtml(fileList);
      setSrcDoc(html);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fileList]);

  return { status, srcDoc };
}
