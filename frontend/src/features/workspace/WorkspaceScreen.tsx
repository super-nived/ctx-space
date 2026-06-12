import { useEffect, useRef, useState } from 'react';

import { useAgentRunner } from '@/features/agent/useAgentRunner';
import { HistorySidebar } from '@/features/projects/HistorySidebar';
import { useProjectSync } from '@/features/projects/useProjectSync';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/sessionStore';

import { ChatPanel } from './ChatPanel';
import { OutputPanel } from './OutputPanel';
import { TopBar } from './TopBar';

interface WorkspaceScreenProps {
  threadId: string;
  /** Non-null only for a brand-new project's first turn; null after a refresh. */
  initialPrompt: string | null;
}

/**
 * Builder workspace — the Lovable two-pane layout:
 *   desktop (lg+): chat ~38% | output ~62%, side by side.
 *   phone/tablet : single pane, toggled between Chat and Preview/Code.
 */
export function WorkspaceScreen({ threadId, initialPrompt }: WorkspaceScreenProps) {
  const [mobileView, setMobileView] = useState<'chat' | 'output'>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);
  const { sendUserMessage, agent } = useAgentRunner();
  const markInitialPromptSent = useSessionStore((s) => s.markInitialPromptSent);
  const sentRef = useRef(false);

  // Persist files + chat to the backend; expose openProject for the sidebar.
  const { openProject } = useProjectSync();

  // Send the landing-screen prompt once the agent is connected (new projects only).
  useEffect(() => {
    if (!sentRef.current && agent && initialPrompt) {
      sentRef.current = true;
      void sendUserMessage(initialPrompt);
      markInitialPromptSent();
    }
  }, [agent, initialPrompt, sendUserMessage, markInitialPromptSent]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        mobileView={mobileView}
        onToggleMobileView={() => setMobileView((v) => (v === 'chat' ? 'output' : 'chat'))}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[38fr_62fr]">
        {/* Chat pane */}
        <div
          className={cn('min-h-0', mobileView === 'chat' ? 'block' : 'hidden', 'lg:block')}
        >
          <ChatPanel threadId={threadId} />
        </div>

        {/* Output pane */}
        <div
          className={cn(
            'min-h-0',
            mobileView === 'output' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <OutputPanel />
        </div>
      </div>

      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpenProject={openProject}
      />
    </div>
  );
}
