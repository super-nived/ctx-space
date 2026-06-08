import { CopilotChat } from '@copilotkit/react-core/v2';

import { useAgentTools } from '@/features/agent/useAgentTools';

const AGENT_ID = 'ctx_space';

interface ChatPanelProps {
  /** One stable thread per project = one continuous conversation (Lovable feel). */
  threadId: string;
}

/**
 * Left pane: the conversational surface. CopilotChat streams assistant messages
 * and renders tool calls (incl. the plan card and Edit #N cards). Bound to the
 * `ctx_space` agent and a single persistent thread so follow-up edits are
 * incremental, never a reset.
 */
export function ChatPanel({ threadId }: ChatPanelProps) {
  // Register writeFile / deleteFile / proposePlan with CopilotKit.
  useAgentTools();

  return (
    <section className="border-border-subtle bg-canvas flex h-full min-h-0 flex-col border-r">
      <CopilotChat
        agentId={AGENT_ID}
        threadId={threadId}
        className="flex h-full min-h-0 flex-col"
        labels={{
          chatInputPlaceholder: 'Describe a change, or ask Context Space to build…',
        }}
      />
    </section>
  );
}
