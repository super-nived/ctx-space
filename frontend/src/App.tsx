import { LandingScreen } from '@/features/landing/LandingScreen';
import { projectsApi } from '@/features/projects/projectsApi';
import { WorkspaceScreen } from '@/features/workspace/WorkspaceScreen';
import { useProjectStore } from '@/store/projectStore';
import { useSessionStore, type TokenUsage } from '@/store/sessionStore';

function makeThreadId(): string {
  return `thread-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function App() {
  const threadId = useSessionStore((s) => s.threadId);
  const initialPrompt = useSessionStore((s) => s.initialPrompt);
  const initialPromptSent = useSessionStore((s) => s.initialPromptSent);
  const startSession = useSessionStore((s) => s.startSession);
  const openExisting = useSessionStore((s) => s.openExisting);
  const setStatus = useProjectStore((s) => s.setStatus);
  const loadFiles = useProjectStore((s) => s.loadFiles);

  const handleCreate = (prompt: string) => {
    setStatus('planning');
    startSession(makeThreadId(), prompt);
  };

  // Open a project directly from the landing page recent-projects grid.
  const handleOpenProject = async (id: string) => {
    const project = await projectsApi.get(id);
    const tid = project.thread_id ?? `thread-${id}`;
    loadFiles(project.name, project.files ?? {});
    openExisting(id, tid, project.token_usage as TokenUsage | undefined);
  };

  // No active session -> landing screen.
  if (!threadId) {
    return <LandingScreen onCreate={handleCreate} onOpenProject={handleOpenProject} />;
  }

  // Restored session (refresh): don't resend the initial prompt.
  return (
    <WorkspaceScreen
      threadId={threadId}
      initialPrompt={initialPromptSent ? null : initialPrompt}
    />
  );
}
