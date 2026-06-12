/**
 * Tracks the *current* project session: which backend project is open, its
 * thread id, and the initial prompt for a brand-new project. Persisted locally
 * so a refresh reopens the same project; the project's files + chat themselves
 * live in the backend (PocketBase) and are loaded by id.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  /** Backend project record id (null until the project is first saved). */
  projectId: string | null;
  threadId: string | null;
  /** First prompt — sent once when a brand-new project is created. */
  initialPrompt: string | null;
  initialPromptSent: boolean;

  startSession: (threadId: string, initialPrompt: string) => void;
  openExisting: (projectId: string, threadId: string) => void;
  setProjectId: (projectId: string) => void;
  markInitialPromptSent: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      projectId: null,
      threadId: null,
      initialPrompt: null,
      initialPromptSent: false,

      startSession: (threadId, initialPrompt) =>
        set({ projectId: null, threadId, initialPrompt, initialPromptSent: false }),

      openExisting: (projectId, threadId) =>
        set({ projectId, threadId, initialPrompt: null, initialPromptSent: true }),

      setProjectId: (projectId) => set({ projectId }),
      markInitialPromptSent: () => set({ initialPromptSent: true }),
      reset: () =>
        set({
          projectId: null,
          threadId: null,
          initialPrompt: null,
          initialPromptSent: false,
        }),
    }),
    { name: 'ctx-space-session' },
  ),
);
