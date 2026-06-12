/**
 * Keeps the open project saved to the backend, and restores a project's chat +
 * files when one is opened. This is what makes projects survive refresh AND lets
 * the user reopen any past project and continue editing (Lovable-style history).
 *
 * - Saves (debounced) whenever files or chat messages change.
 * - On opening an existing project, loads its files into the store and replays
 *   its chat messages into the agent thread.
 */
import { useAgent } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

import { projectsApi } from './projectsApi';

const AGENT_ID = 'ctx_space';
const SAVE_DEBOUNCE_MS = 1200;

export function useProjectSync() {
  const { agent } = useAgent({ agentId: AGENT_ID });
  const files = useProjectStore((s) => s.files);
  const projectName = useProjectStore((s) => s.projectName);
  const loadFiles = useProjectStore((s) => s.loadFiles);

  const projectId = useSessionStore((s) => s.projectId);
  const threadId = useSessionStore((s) => s.threadId);
  const setProjectId = useSessionStore((s) => s.setProjectId);
  const openExisting = useSessionStore((s) => s.openExisting);

  const [messages, setMessages] = useState<unknown[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);

  // Track agent messages so we can persist the conversation.
  useEffect(() => {
    if (!agent) return;
    const sub = agent.subscribe({
      onMessagesChanged: () => setMessages([...(agent.messages ?? [])]),
    });
    return () => sub.unsubscribe?.();
  }, [agent]);

  const persist = useCallback(async () => {
    const fileMap: Record<string, string> = {};
    for (const [path, f] of Object.entries(files)) fileMap[path] = f.contents;

    // Don't create an empty project (no files and no chat yet).
    const hasContent = Object.keys(fileMap).length > 0 || messages.length > 0;
    if (!hasContent) return;

    try {
      if (projectId) {
        await projectsApi.update(projectId, {
          name: projectName,
          files: fileMap,
          messages,
        });
      } else if (!creatingRef.current) {
        creatingRef.current = true;
        const created = await projectsApi.create({
          name: projectName,
          files: fileMap,
          messages,
          thread_id: threadId ?? undefined,
        });
        setProjectId(created.id);
        creatingRef.current = false;
      }
    } catch {
      creatingRef.current = false;
      // Best-effort save; failures shouldn't break the editing session.
    }
  }, [files, messages, projectName, projectId, threadId, setProjectId]);

  // Debounced save on any change.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persist]);

  /** Open an existing project: load files + point the session at its thread.
   *  Changing the thread re-binds CopilotChat; useChatRestore (in ChatPanel) then
   *  replays the saved conversation. No page reload needed. */
  const openProject = useCallback(
    async (id: string) => {
      const project = await projectsApi.get(id);
      const tid = project.thread_id ?? `thread-${id}`;
      loadFiles(project.name, project.files ?? {});
      openExisting(id, tid);
      // Seed local state so the next debounced save targets this project.
      if (Array.isArray(project.messages)) setMessages(project.messages);
    },
    [loadFiles, openExisting],
  );

  return { openProject };
}
