import '@copilotkit/react-ui/v2/styles.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CopilotProvider } from '@/app/CopilotProvider';
import App from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotProvider>
      <App />
    </CopilotProvider>
  </StrictMode>,
);
