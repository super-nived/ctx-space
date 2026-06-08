/**
 * Thin helper over the CopilotKit/AG-UI agent for programmatic message sending.
 * Used for (a) the first prompt from the landing screen and (b) the self-healing
 * loop's synthetic error messages (P3b). Both append a user message to the
 * thread and run the agent — exactly as if the user had typed it.
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useCallback } from 'react';

const AGENT_ID = 'ctx_space';

function makeId(): string {
  return `msg-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function useAgentRunner() {
  const { agent } = useAgent({ agentId: AGENT_ID });

  const sendUserMessage = useCallback(
    async (content: string) => {
      if (!agent) return;
      agent.addMessage({ id: makeId(), role: 'user', content });
      await agent.runAgent();
    },
    [agent],
  );

  return { sendUserMessage, agent };
}
