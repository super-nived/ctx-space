/**
 * Keeps the open project saved to the backend, and restores a project's chat +
 * files when one is opened.
 *
 * - Saves (debounced) whenever files or chat messages change.
 * - After each agent run completes, fetches /api/usage?thread_id=X and
 *   accumulates the token cost into the session store + PocketBase.
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';
import { useSessionStore, type TokenUsage } from '@/store/sessionStore';

import { projectsApi } from './projectsApi';

const AGENT_ID = 'ctx_space';
const SAVE_DEBOUNCE_MS = 1200;
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export function useProjectSync() {
  const { agent } = useAgent({ agentId: AGENT_ID });
  const files = useProjectStore((s) => s.files);
  const projectName = useProjectStore((s) => s.projectName);
  const loadFiles = useProjectStore((s) => s.loadFiles);

  const projectId = useSessionStore((s) => s.projectId);
  const threadId = useSessionStore((s) => s.threadId);
  const tokenUsage = useSessionStore((s) => s.tokenUsage);
  const setProjectId = useSessionStore((s) => s.setProjectId);
  const openExisting = useSessionStore((s) => s.openExisting);
  const setTokenUsage = useSessionStore((s) => s.setTokenUsage);

  const [messages, setMessages] = useState<unknown[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);
  // Track previous isRunning to detect run-end transitions.
  const wasRunningRef = useRef(false);

  // Track agent messages so we can persist the conversation.
  useEffect(() => {
    if (!agent) return;
    const sub = agent.subscribe({
      onMessagesChanged: () => setMessages([...(agent.messages ?? [])]),
    });
    return () => sub.unsubscribe?.();
  }, [agent]);

  // After each run completes, fetch cumulative usage from the backend.
  useEffect(() => {
    if (!agent || !threadId) return;
    const sub = agent.subscribe({
      onStateChanged: () => {
        const running = agent.isRunning ?? false;
        if (wasRunningRef.current && !running) {
          // Run just ended — fetch usage from server.
          void fetch(`${API_BASE}/api/usage?thread_id=${encodeURIComponent(threadId)}`)
            .then((r) => r.json())
            .then((data: TokenUsage) => {
              if (data.cost_usd > 0 || data.input_tokens > 0) {
                setTokenUsage(data);
              }
            })
            .catch(() => {});
        }
        wasRunningRef.current = running;
      },
    });
    return () => sub.unsubscribe?.();
  }, [agent, threadId, setTokenUsage]);

  const persist = useCallback(async () => {
    const fileMap: Record<string, string> = {};
    for (const [path, f] of Object.entries(files)) fileMap[path] = f.contents;

    const hasContent = Object.keys(fileMap).length > 0 || messages.length > 0;
    if (!hasContent) return;

    try {
      if (projectId) {
        await projectsApi.update(projectId, {
          name: projectName,
          files: fileMap,
          messages,
          token_usage: tokenUsage,
        });
      } else if (!creatingRef.current) {
        creatingRef.current = true;
        const created = await projectsApi.create({
          name: projectName,
          files: fileMap,
          messages,
          thread_id: threadId ?? undefined,
          token_usage: tokenUsage,
        });
        setProjectId(created.id);
        creatingRef.current = false;
      }
    } catch {
      creatingRef.current = false;
    }
  }, [files, messages, projectName, projectId, threadId, tokenUsage, setProjectId]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persist]);

  const openProject = useCallback(
    async (id: string) => {
      const project = await projectsApi.get(id);
      const tid = project.thread_id ?? `thread-${id}`;
      loadFiles(project.name, project.files ?? {});
      openExisting(id, tid, project.token_usage as TokenUsage | undefined);
      if (Array.isArray(project.messages)) setMessages(project.messages);
    },
    [loadFiles, openExisting],
  );

  return { openProject };
}
