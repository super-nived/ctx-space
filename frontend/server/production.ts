/**
 * Production Node server: serves the Vite build (dist/) and mounts the
 * CopilotKit runtime at /api/copilotkit — mirroring what copilotRuntimePlugin
 * does in dev mode.
 *
 * Usage: node dist-server/production.js
 * Build: tsc -p tsconfig.server.json
 *
 * Env vars:
 *   AGENT_URL   FastAPI backend URL (default http://backend:8000/)
 *   PORT        Listen port (default 3000)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const AGENT_URL = process.env.AGENT_URL ?? 'http://backend:8000/';
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const AGENT_NAME = 'ctx_space';
const COPILOT_BASE = '/api/copilotkit';

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

async function startServer() {
  const { CopilotRuntime } = await import('@copilotkit/runtime/v2');
  const { createCopilotNodeListener } = await import('@copilotkit/runtime/v2/node');
  const { HttpAgent } = await import('@ag-ui/client');

  const runtime = new CopilotRuntime({
    agents: {
      [AGENT_NAME]: new HttpAgent({ url: AGENT_URL }) as unknown as never,
    },
  });

  const copilotListener = createCopilotNodeListener({
    runtime,
    basePath: COPILOT_BASE,
    cors: true,
  }) as (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // CopilotKit API
    if (url.startsWith(COPILOT_BASE)) {
      copilotListener(req, res, () => {
        res.writeHead(404);
        res.end('not found');
      });
      return;
    }

    // Static files from dist/
    let filePath = path.join(DIST, url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, 'index.html');
    }
    const ext = path.extname(filePath);
    const mime = MIME[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(PORT, () => {
    console.log(`ctx-space frontend listening on :${PORT}`);
    console.log(`  CopilotKit → ${AGENT_URL} (agent "${AGENT_NAME}")`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
