import { CopilotChat } from '@copilotkit/react-core/v2';

import { useAgentTools } from '@/features/agent/useAgentTools';
import { useChatRestore } from '@/features/projects/useChatRestore';

const AGENT_ID = 'ctx_space';

interface ChatPanelProps {
  threadId: string;
}

export function ChatPanel({ threadId }: ChatPanelProps) {
  useAgentTools();
  useChatRestore(threadId);

  return (
    <section
      className="flex h-full min-h-0 flex-col border-r"
      style={{ background: 'var(--canvas)', borderColor: 'var(--border)' }}
    >
      <CopilotChat
        agentId={AGENT_ID}
        threadId={threadId}
        className="copilotKitChat flex h-full min-h-0 flex-col"
        attachments={{
          enabled: true,
          accept: 'image/*',
          maxSize: 10 * 1024 * 1024,
        }}
        labels={{
          chatInputPlaceholder:
            'Describe a change, paste an image, or ask Context Space to build…',
        }}
      />
    </section>
  );
}
