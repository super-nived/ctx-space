/**
 * Registers the agent's frontend tools with CopilotKit. The agent (agent.py)
 * emits TOOL_CALL_* events for these; CopilotKit runs the handlers here in the
 * browser. This is where generated code lands in the virtual FS (and, in P3,
 * the WebContainer).
 */
import { useFrontendTool, useHumanInTheLoop } from '@copilotkit/react-core/v2';
import { z } from 'zod';

import { useProjectStore } from '@/store/projectStore';

import { DataSpaceConnectCard } from './DataSpaceConnectCard';
import { PlanCard } from './PlanCard';

export function useAgentTools() {
  const writeFile = useProjectStore((s) => s.writeFile);
  const deleteFile = useProjectStore((s) => s.deleteFile);
  const setStatus = useProjectStore((s) => s.setStatus);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setProjectName = useProjectStore((s) => s.setProjectName);

  // proposePlan — render-and-wait approval card (human-in-the-loop).
  useHumanInTheLoop({
    name: 'proposePlan',
    description:
      'Propose a build plan and wait for the user to approve or request changes before writing any code.',
    parameters: z.object({
      appName: z.string().describe('Short name for the app'),
      features: z.array(z.string()).describe('3-6 feature bullets'),
      files: z.array(z.string()).describe('Files that will be created'),
    }),
    render: ({ args, status, respond }) => {
      // Set the project name as soon as the agent proposes the plan.
      if (args.appName && args.appName !== 'Untitled') {
        setProjectName(args.appName);
      }
      return (
        <PlanCard
          appName={args.appName ?? ''}
          features={args.features ?? []}
          files={args.files ?? []}
          status={status}
          onApprove={() => {
            setStatus('building');
            respond?.({ approved: true });
          }}
          onRequestChanges={(note) => respond?.({ approved: false, note })}
        />
      );
    },
  });

  // connectDataSpace — render-and-wait connect form (human-in-the-loop).
  // Credentials are returned as the tool result and never leave this chat turn.
  useHumanInTheLoop({
    name: 'connectDataSpace',
    description:
      'Show a form asking the user to paste their DataSpace connection credentials.',
    parameters: z.object({}),
    render: ({ status, respond }) => (
      <DataSpaceConnectCard status={status} onSubmit={(creds) => respond?.(creds)} />
    ),
  });

  // writeFile — create or update a file (the core code-gen action).
  useFrontendTool({
    name: 'writeFile',
    description:
      'Create or overwrite a single file in the project. Call once per file so progress is visible.',
    parameters: z.object({
      path: z.string().describe('Project-relative path, e.g. src/App.tsx'),
      contents: z.string().describe('Complete file contents'),
    }),
    handler: async ({ path, contents }) => {
      writeFile(path, contents);
      setActiveFile(path);
      return `Wrote ${path} (${contents.length} bytes).`;
    },
  });

  // deleteFile — remove a file.
  useFrontendTool({
    name: 'deleteFile',
    description: 'Delete a file from the project.',
    parameters: z.object({
      path: z.string().describe('Project-relative path to delete'),
    }),
    handler: async ({ path }) => {
      deleteFile(path);
      return `Deleted ${path}.`;
    },
  });
}
