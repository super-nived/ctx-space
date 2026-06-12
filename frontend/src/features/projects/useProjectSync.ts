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

  // On mount/refresh, replay this thread's saved messages into the agent so the
  // conversation reappears (our backend agent is stateless — we restore client-side).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!agent || !threadId || restoredRef.current) return;
    if ((agent.messages?.length ?? 0) > 0) {
      restoredRef.current = true;
      return;
    }
    const cached = sessionStorage.getItem(`ctx-restore-${threadId}`);
    if (cached) {
      restoredRef.current = true;
      // Defer so state isn't set synchronously inside the effect body.
      void Promise.resolve().then(() => {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            agent.setMessages(parsed as never);
            setMessages(parsed);
          }
        } catch {
          /* ignore */
        }
      });
      return;
    }

    // No cache (plain refresh of the current project): fetch messages from backend.
    if (projectId) {
      restoredRef.current = true;
      projectsApi
        .get(projectId)
        .then((p) => {
          if (Array.isArray(p.messages) && p.messages.length > 0) {
            agent.setMessages(p.messages as never);
            setMessages(p.messages);
          }
        })
        .catch(() => {
          /* offline / missing — chat just starts empty */
        });
    }
  }, [agent, threadId, projectId]);

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

  /** Open an existing project: load its files + chat thread, then continue editing. */
  const openProject = useCallback(
    async (id: string) => {
      const project = await projectsApi.get(id);
      loadFiles(project.name, project.files ?? {});
      // Point the session at this project + its thread, then reload so CopilotChat
      // rebinds to the thread and the agent replays the saved conversation.
      const tid = project.thread_id ?? `thread-${id}`;
      openExisting(id, tid);
      // Cache the messages so they can be replayed immediately after reload.
      try {
        sessionStorage.setItem(
          `ctx-restore-${tid}`,
          JSON.stringify(project.messages ?? []),
        );
      } catch {
        /* sessionStorage may be unavailable; chat will still reload by thread */
      }
      window.location.reload();
    },
    [loadFiles, openExisting],
  );

  return { openProject };
}
