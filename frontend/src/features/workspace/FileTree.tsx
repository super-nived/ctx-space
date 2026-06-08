import { useMemo } from 'react';

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
        node.children.set(part, {
          name: part,
          path: childPath,
          children: new Map(),
          isFile,
        });
      }
      node = node.children.get(part)!;
    });
  }
  return root;
}

function TreeBranch({ node, depth }: { node: TreeNode; depth: number }) {
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const entries = [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1; // folders first
    return a.name.localeCompare(b.name);
  });

  return (
    <ul>
      {entries.map((child) => (
        <li key={child.path}>
          <button
            type="button"
            onClick={() => child.isFile && setActiveFile(child.path)}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] transition',
              child.isFile ? 'text-ink-soft hover:bg-surface-2' : 'text-ink font-medium',
              activeFilePath === child.path && 'bg-brand-50 text-brand-700',
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span aria-hidden className="text-ink-muted">
              {child.isFile ? '📄' : '📁'}
            </span>
            <span className="truncate">{child.name}</span>
          </button>
          {!child.isFile && <TreeBranch node={child} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/** Collapsible file tree reflecting the virtual FS (Code tab, left column). */
export function FileTree() {
  const files = useProjectStore((s) => s.files);
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  if (Object.keys(files).length === 0) {
    return <p className="text-ink-muted p-3 text-[13px]">No files yet.</p>;
  }
  return (
    <nav className="overflow-y-auto py-1" aria-label="Project files">
      <TreeBranch node={tree} depth={0} />
    </nav>
  );
}
