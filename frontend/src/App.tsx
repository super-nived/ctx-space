import { LandingScreen } from '@/features/landing/LandingScreen';
import { WorkspaceScreen } from '@/features/workspace/WorkspaceScreen';
import { useProjectStore } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';

function makeThreadId(): string {
  return `thread-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function App() {
  const threadId = useSessionStore((s) => s.threadId);
  const initialPrompt = useSessionStore((s) => s.initialPrompt);
  const initialPromptSent = useSessionStore((s) => s.initialPromptSent);
  const startSession = useSessionStore((s) => s.startSession);
  const setStatus = useProjectStore((s) => s.setStatus);

  const handleCreate = (prompt: string) => {
    setStatus('planning');
    startSession(makeThreadId(), prompt);
  };

  // No active session -> landing screen.
  if (!threadId) {
    return <LandingScreen onCreate={handleCreate} />;
  }

  // Restored session (refresh): don't resend the initial prompt.
  return (
    <WorkspaceScreen
      threadId={threadId}
      initialPrompt={initialPromptSent ? null : initialPrompt}
    />
  );
}
