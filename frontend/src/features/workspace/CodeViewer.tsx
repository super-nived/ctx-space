import { useProjectStore } from '@/store/projectStore';

import { FileTree } from './FileTree';

/**
 * Code tab: file tree on the left, read-only code viewer on the right.
 * (Monaco/CodeMirror with syntax highlighting can replace the <pre> later — v1
 * keeps it dependency-light and read-only per the spec.)
 */
export function CodeViewer() {
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const file = useProjectStore((s) => (activeFilePath ? s.files[activeFilePath] : null));

  return (
    <div className="flex h-full min-h-0">
      <aside className="border-border-subtle bg-surface w-56 shrink-0 border-r">
        <FileTree />
      </aside>
      <div className="bg-canvas min-w-0 flex-1 overflow-auto">
        {file ? (
          <>
            <div className="border-border-subtle bg-surface text-ink-soft sticky top-0 border-b px-4 py-2 text-[13px]">
              {file.path}
            </div>
            <pre className="text-ink overflow-x-auto p-4 text-[13px] leading-relaxed">
              <code>{file.contents}</code>
            </pre>
          </>
        ) : (
          <div className="text-ink-muted grid h-full place-items-center text-sm">
            Select a file to view its code.
          </div>
        )}
      </div>
    </div>
  );
}
