import { useProjectStore } from '@/store/projectStore';

import { FileTree } from './FileTree';

export function CodeViewer() {
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const file = useProjectStore((s) => (activeFilePath ? s.files[activeFilePath] : null));

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <FileTree />
      </aside>
      <div className="min-w-0 flex-1 overflow-auto" style={{ background: 'var(--canvas)' }}>
        {file ? (
          <>
            <div
              className="sticky top-0 border-b px-4 py-2 text-[13px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
            >
              {file.path}
            </div>
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ color: 'var(--ink)' }}>
              <code>{file.contents}</code>
            </pre>
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            Select a file to view its code.
          </div>
        )}
      </div>
    </div>
  );
}
