import { Wordmark } from '@/components/Wordmark';
import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

interface TopBarProps {
  onToggleMobileView?: () => void;
  mobileView?: 'chat' | 'output';
}

/** Slim top bar: wordmark + project name (left); New/History/GitHub/Publish (right). */
export function TopBar({ onToggleMobileView, mobileView }: TopBarProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const resetProject = useProjectStore((s) => s.resetProject);
  const resetSession = useSessionStore((s) => s.reset);

  const newProject = () => {
    if (
      !confirm(
        'Start a new project? The current one is saved in your browser but will be cleared from view.',
      )
    ) {
      return;
    }
    resetProject();
    resetSession();
    // Reload to tear down the running WebContainer cleanly.
    window.location.reload();
  };

  return (
    <header className="border-border-subtle bg-canvas flex h-12 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-3">
        <Wordmark showFull={false} />
        <button
          type="button"
          className="text-ink hover:bg-surface-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium"
        >
          {projectName}
          <span className="text-ink-muted">▾</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Mobile: toggle between Chat and Preview/Code */}
        {onToggleMobileView && (
          <button
            type="button"
            onClick={onToggleMobileView}
            className="border-border-subtle text-ink-soft mr-1 rounded-md border px-2.5 py-1 text-[13px] lg:hidden"
          >
            {mobileView === 'chat' ? 'Preview' : 'Chat'}
          </button>
        )}
        <button
          type="button"
          onClick={newProject}
          className="text-ink-soft hover:bg-surface-2 rounded-md px-2.5 py-1 text-[13px]"
        >
          New
        </button>
        <button
          type="button"
          className="text-ink-soft hover:bg-surface-2 rounded-md px-2.5 py-1 text-[13px]"
        >
          History
        </button>
        <button
          type="button"
          className="text-ink-soft hover:bg-surface-2 rounded-md px-2.5 py-1 text-[13px]"
        >
          GitHub
        </button>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
        >
          Publish
        </button>
      </div>
    </header>
  );
}
