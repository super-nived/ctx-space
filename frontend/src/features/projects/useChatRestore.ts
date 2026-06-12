/**
 * Restores a project's saved conversation into the live agent that CopilotChat
 * renders from. Runs inside ChatPanel so it shares CopilotChat's agent instance
 * and fires AFTER the chat has bound to the thread.
 *
 * Our backend agent is stateless (it doesn't store threads), so when CopilotChat
 * binds a thread it has no history to replay — we supply it here from PocketBase.
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useEffect, useRef } from 'react';

import { useSessionStore } from '@/store/sessionStore';

import { projectsApi } from './projectsApi';

const AGENT_ID = 'ctx_space';

export function useChatRestore(threadId: string) {
  const { agent } = useAgent({ agentId: AGENT_ID });
  const projectId = useSessionStore((s) => s.projectId);
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!agent || !projectId) return;
    // Only restore once per thread, and only if the chat is currently empty
    // (so we never clobber a live, in-progress conversation).
    if (doneFor.current === threadId) return;

    let cancelled = false;
    // Wait a tick so CopilotChat finishes binding the thread before we set msgs.
    const timer = setTimeout(() => {
      if (cancelled) return;
      // Never touch the agent mid-run (avoids RUN_STARTED/RUN_ERROR races).
      if (agent.isRunning) return;
      if ((agent.messages?.length ?? 0) > 0) {
        doneFor.current = threadId;
        return;
      }
      void projectsApi
        .get(projectId)
        .then((p) => {
          if (cancelled || agent.isRunning) return;
          if (
            (agent.messages?.length ?? 0) === 0 &&
            Array.isArray(p.messages) &&
            p.messages.length > 0
          ) {
            // setMessages only replaces the local list — it does NOT start a run.
            agent.setMessages(p.messages as never);
          }
          doneFor.current = threadId;
        })
        .catch(() => {
          doneFor.current = threadId;
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [agent, projectId, threadId]);
}
