import '@copilotkit/react-ui/v2/styles.css';
import './index.css';

import { createRoot } from 'react-dom/client';

import { CopilotProvider } from '@/app/CopilotProvider';
import App from '@/App';

// Intercept the agent SSE stream to parse custom USAGE frames and dispatch
// them as a DOM event so useProjectSync can accumulate token costs in the store.
(function patchFetchForUsage() {
  const _fetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const res = await _fetch(...args);
    // Only intercept the CopilotKit runtime endpoint (all SSE agent calls go here).
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    if (!url.includes('/api/copilotkit') && !url.includes('localhost:8000')) return res;
    if (res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
      const [a, b] = res.body.tee();
      // Read USAGE frames from the cloned stream without blocking the original.
      void (async () => {
        const reader = b.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const ev = JSON.parse(line.slice(5).trim());
              if (ev.type === 'USAGE') {
                window.dispatchEvent(new CustomEvent('ctx:usage', { detail: ev }));
              }
            } catch {
              // not JSON — ignore
            }
          }
        }
      })();
      return new Response(a, { status: res.status, headers: res.headers });
    }
    return res;
  };
})();

// NOTE: StrictMode is intentionally omitted. Its dev-only double-mount makes
// CopilotKit's AG-UI agent connect twice at once, which collides into
// "Cannot send RUN_STARTED: the run has already errored". CopilotKit's agent
// connection isn't double-connect-safe, so we mount once.
createRoot(document.getElementById('root')!).render(
  <CopilotProvider>
    <App />
  </CopilotProvider>,
);
