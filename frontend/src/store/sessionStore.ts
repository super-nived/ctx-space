/**
 * Persists the current project session (thread id + the initial prompt) so a
 * page refresh restores the same conversation. CopilotKit keys its thread by
 * `threadId`, so reusing it reloads the chat history; the project store reloads
 * the files + edit history alongside it.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  threadId: string | null;
  /** The very first prompt — sent once when a new project is created. */
  initialPrompt: string | null;
  /** True once the initial prompt has been dispatched (so refresh won't resend). */
  initialPromptSent: boolean;

  startSession: (threadId: string, initialPrompt: string) => void;
  markInitialPromptSent: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      threadId: null,
      initialPrompt: null,
      initialPromptSent: false,

      startSession: (threadId, initialPrompt) =>
        set({ threadId, initialPrompt, initialPromptSent: false }),
      markInitialPromptSent: () => set({ initialPromptSent: true }),
      reset: () => set({ threadId: null, initialPrompt: null, initialPromptSent: false }),
    }),
    { name: 'ctx-space-session' },
  ),
);
