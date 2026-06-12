/**
 * Single source of truth for "is the agent currently running?".
 * Also surfaces the last file the agent wrote so UI can show "Writing src/App.tsx…"
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useEffect, useRef, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';

const AGENT_ID = 'ctx_space';

export function useAgentStatus() {
  const { agent } = useAgent({ agentId: AGENT_ID });
  const [isRunning, setIsRunning] = useState(false);
  const status = useProjectStore((s) => s.status);
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  // Track the last file written during a run so we can show "Writing X…"
  const [lastWrittenFile, setLastWrittenFile] = useState<string | null>(null);
  const prevFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    const sub = agent.subscribe({
      onStateChanged: () => {
        setIsRunning(agent.isRunning ?? false);
      },
    });
    return () => sub.unsubscribe?.();
  }, [agent]);

  // When agent writes a file during a run, capture it.
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
