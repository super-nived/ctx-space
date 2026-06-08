import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import type { ReactNode } from 'react';

const RUNTIME_URL = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL ?? '/api/copilotkit';

/**
 * Wraps the app in the CopilotKit provider. `runtimeUrl` points at the Vite
 * middleware (server/copilotRuntimePlugin.ts), which bridges to the FastAPI
 * AG-UI agent. The agent name "ctx_space" matches the runtime config.
 */
export function CopilotProvider({ children }: { children: ReactNode }) {
  return <CopilotKitProvider runtimeUrl={RUNTIME_URL}>{children}</CopilotKitProvider>;
}
