import '@copilotkit/react-ui/v2/styles.css';
import './index.css';

import { createRoot } from 'react-dom/client';

import { CopilotProvider } from '@/app/CopilotProvider';
import App from '@/App';
import { resolveIsDark, useThemeStore } from '@/store/themeStore';

// Apply theme class to <html> before first paint, and keep it in sync.
function applyTheme() {
  const { theme } = useThemeStore.getState();
  document.documentElement.classList.toggle('dark', resolveIsDark(theme));
}

applyTheme();
useThemeStore.subscribe((s) => {
  document.documentElement.classList.toggle('dark', resolveIsDark(s.theme));
});

// Watch system preference changes.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// NOTE: StrictMode omitted — CopilotKit AG-UI double-mount causes RUN_ERROR collision.
createRoot(document.getElementById('root')!).render(
  <CopilotProvider>
    <App />
  </CopilotProvider>,
);
