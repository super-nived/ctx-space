import { useMemo } from 'react';

import { useAgentStatus } from '@/features/agent/useAgentStatus';
import { cn } from '@/lib/cn';
import { useProjectStore } from '@/store/projectStore';

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map(), isFile: false };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join('/');
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path: childPath, children: new Map(), isFile });
      }
      node = node.children.get(part)!;
    });
  }
  return root;
}

function TreeBranch({ node, depth, writingPath }: { node: TreeNode; depth: number; writingPath: string | null }) {
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const entries = [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ul>
      {entries.map((child) => {
        const isWriting = child.isFile && child.path === writingPath;
        const isActive = activeFilePath === child.path;

        return (
          <li key={child.path}>
            <button
              type="button"
              onClick={() => child.isFile && setActiveFile(child.path)}
              className={cn('flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] transition')}
              style={{
                paddingLeft: `${depth * 12 + 8}px`,
                background: isWriting || isActive ? 'var(--indigo-lt)' : undefined,
                color: isWriting || isActive
                  ? 'var(--indigo)'
                  : child.isFile
                    ? 'var(--ink-soft)'
                    : 'var(--ink)',
                fontWeight: child.isFile ? undefined : 500,
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isWriting) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isActive && !isWriting) (e.currentTarget as HTMLButtonElement).style.background = '';
              }}
            >
              {child.isFile ? (
                isWriting ? (
                  <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                    <span className="absolute h-3.5 w-3.5 animate-ping rounded-full opacity-40" style={{ background: 'var(--indigo)' }} />
                    <span className="relative h-2 w-2 rounded-full" style={{ background: 'var(--indigo)' }} />
                  </span>
                ) : (
                  <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 8.75 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19l-2.44-2.44z" />
                  </svg>
                )
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0 opacity-50" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1H13a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 13 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75a1.75 1.75 0 0 1 .513-1.237z" />
                </svg>
              )}
              <span className="truncate">{child.name}</span>
              {isWriting && (
                <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--indigo)' }}>writing</span>
              )}
            </button>
            {!child.isFile && (
              <TreeBranch node={child} depth={depth + 1} writingPath={writingPath} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FileTree() {
  const files = useProjectStore((s) => s.files);
  const { isRunning, lastWrittenFile } = useAgentStatus();
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
        <svg className="h-8 w-8" style={{ color: 'var(--ink-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25" />
        </svg>
        <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>No files yet</p>
      </div>
    );
  }

  return (
    <nav className="overflow-y-auto py-1" aria-label="Project files">
      {isRunning && (
        <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-md px-2 py-1.5"
          style={{ background: 'var(--indigo-lt)' }}>
          <span className="dot-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
          <span className="dot-2 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
          <span className="dot-3 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--indigo)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--indigo)' }}>Agent writing…</span>
        </div>
      )}
      <TreeBranch node={tree} depth={0} writingPath={isRunning ? lastWrittenFile : null} />
    </nav>
  );
}
