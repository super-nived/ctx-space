import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { copilotRuntimePlugin } from './server/copilotRuntimePlugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const agentUrl = env.AGENT_URL ?? 'http://localhost:8000/';

  return {
    plugins: [react(), copilotRuntimePlugin({ agentUrl })],
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // NOTE: no COOP/COEP headers. They were needed for WebContainers (since
    // replaced by the esm.sh preview) and actively BLOCK CDN resources (Tailwind,
    // esm.sh) from loading inside the preview iframe under COEP. Keep them off.
  };
});
