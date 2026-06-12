/**
 * Tracks the *current* project session: which backend project is open, its
 * thread id, and the initial prompt for a brand-new project. Persisted locally
 * so a refresh reopens the same project; the project's files + chat themselves
 * live in the backend (PocketBase) and are loaded by id.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface SessionState {
  /** Backend project record id (null until the project is first saved). */
  projectId: string | null;
  threadId: string | null;
  /** First prompt — sent once when a brand-new project is created. */
  initialPrompt: string | null;
  initialPromptSent: boolean;
  /** Cumulative token usage for the current project (from backend USAGE events). */
  tokenUsage: TokenUsage;

  startSession: (threadId: string, initialPrompt: string) => void;
  openExisting: (projectId: string, threadId: string, usage?: TokenUsage) => void;
  setProjectId: (projectId: string) => void;
  markInitialPromptSent: () => void;
  addTokenUsage: (delta: TokenUsage) => void;
  setTokenUsage: (usage: TokenUsage) => void;
  reset: () => void;
}

const ZERO_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      projectId: null,
      threadId: null,
      initialPrompt: null,
      initialPromptSent: false,
      tokenUsage: ZERO_USAGE,

      startSession: (threadId, initialPrompt) =>
        set({
          projectId: null,
          threadId,
          initialPrompt,
          initialPromptSent: false,
          tokenUsage: ZERO_USAGE,
        }),

      openExisting: (projectId, threadId, usage) =>
        set({
          projectId,
          threadId,
          initialPrompt: null,
          initialPromptSent: true,
          tokenUsage: usage ?? ZERO_USAGE,
        }),

      setProjectId: (projectId) => set({ projectId }),
      markInitialPromptSent: () => set({ initialPromptSent: true }),

      addTokenUsage: (delta) => {
        const cur = get().tokenUsage;
        set({
          tokenUsage: {
            input_tokens: cur.input_tokens + delta.input_tokens,
            output_tokens: cur.output_tokens + delta.output_tokens,
            cost_usd: cur.cost_usd + delta.cost_usd,
          },
        });
      },

      setTokenUsage: (usage) => set({ tokenUsage: usage }),

      reset: () =>
        set({
          projectId: null,
          threadId: null,
          initialPrompt: null,
          initialPromptSent: false,
          tokenUsage: ZERO_USAGE,
        }),
    }),
    { name: 'ctx-space-session' },
  ),
);
