/**
 * Single source of truth for "is the agent currently running?".
 * Reads agent.isRunning directly — useAgent() returns a reactive proxy so
 * any component using this hook re-renders automatically when isRunning changes.
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useEffect, useRef, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';

const AGENT_ID = 'ctx_space';

export function useAgentStatus() {
  const { agent } = useAgent({ agentId: AGENT_ID });
  // agent.isRunning is a reactive property — reading it here causes this hook's
  // consumer to re-render whenever it changes, no subscription needed.
  const isRunning = agent?.isRunning ?? false;
  const status = useProjectStore((s) => s.status);
  const activeFilePath = useProjectStore((s) => s.activeFilePath);

  const [lastWrittenFile, setLastWrittenFile] = useState<string | null>(null);
  const prevFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (isRunning && activeFilePath && activeFilePath !== prevFileRef.current) {
      prevFileRef.current = activeFilePath;
      setLastWrittenFile(activeFilePath);
    }
    if (!isRunning) {
      prevFileRef.current = null;
      setLastWrittenFile(null);
    }
  }, [isRunning, activeFilePath]);

  const phase =
    isRunning && status === 'building'
      ? 'building'
      : isRunning
        ? 'thinking'
        : status === 'ready'
          ? 'ready'
          : status === 'error'
            ? 'error'
            : 'idle';

  return { isRunning, phase, lastWrittenFile, status };
}
