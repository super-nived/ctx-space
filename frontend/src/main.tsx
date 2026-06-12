import '@copilotkit/react-ui/v2/styles.css';
import './index.css';

import { createRoot } from 'react-dom/client';

import { CopilotProvider } from '@/app/CopilotProvider';
import App from '@/App';

// NOTE: StrictMode is intentionally omitted. Its dev-only double-mount makes
// CopilotKit's AG-UI agent connect twice at once, which collides into
// "Cannot send RUN_STARTED: the run has already errored". CopilotKit's agent
// connection isn't double-connect-safe, so we mount once.
createRoot(document.getElementById('root')!).render(
  <CopilotProvider>
    <App />
  </CopilotProvider>,
);
