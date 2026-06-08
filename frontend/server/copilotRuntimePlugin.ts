/**
 * Vite plugin that mounts the CopilotKit runtime as dev-server middleware.
 *
 * A Vite SPA has no server of its own, but the CopilotKit runtime needs Node to
 * (a) bridge securely to our AG-UI agent (FastAPI) and (b) later hold the GitHub
 * OAuth token server-side. This plugin runs the runtime's Node listener at
 * `/api/copilotkit`, pointing at the FastAPI agent via `HttpAgent`.
 *
 * The single `agentUrl` is the config flag from build-plan.md §9 — point it at any
 * AG-UI backend without touching the React app.
 *
 * For production, mirror this handler in your deploy target (Node server, edge
 * function, or container) — the listener is environment-agnostic.
 */
import type { Connect, Plugin } from 'vite';

interface CopilotRuntimePluginOptions {
  agentUrl: string;
  basePath?: string;
}

const AGENT_NAME = 'ctx_space';

export function copilotRuntimePlugin(options: CopilotRuntimePluginOptions): Plugin {
  const basePath = options.basePath ?? '/api/copilotkit';

  return {
    name: 'ctx-space-copilot-runtime',
    apply: 'serve',
    async configureServer(server) {
      // Imported lazily so the (Node-only) runtime never leaks into the client bundle.
      const { CopilotRuntime } = await import('@copilotkit/runtime/v2');
      const { createCopilotNodeListener } = await import('@copilotkit/runtime/v2/node');
      const { HttpAgent } = await import('@ag-ui/client');

      const runtime = new CopilotRuntime({
        agents: {
          // Cast through unknown: the runtime bundles its own copy of
          // @ag-ui/client, so the AbstractAgent nominal types differ even though
          // the instance is correct at runtime.
          [AGENT_NAME]: new HttpAgent({ url: options.agentUrl }) as unknown as never,
        },
      });

      const listener = createCopilotNodeListener({
        runtime,
        basePath,
        cors: true,
      }) as unknown as Connect.NextHandleFunction;

      // Mount at root: the listener matches `basePath` itself, so mounting it
      // under `basePath` would strip the prefix and cause 404s. We gate by URL
      // to avoid intercepting other Vite requests.
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith(basePath)) {
          listener(req, res, next);
        } else {
          next();
        }
      });

      server.config.logger.info(
        `  ➜  CopilotKit runtime: ${basePath} → ${options.agentUrl} (agent "${AGENT_NAME}")`,
      );
    },
  };
}
