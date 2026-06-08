/**
 * Optional starter files shown before the agent writes anything. With the
 * esm.sh + Babel preview, no package.json / vite config is needed — bare imports
 * (react, lucide-react, …) resolve straight from the CDN, and src/index.css is
 * applied globally. The agent overwrites these as it builds.
 */

export const TEMPLATE_FILES: Record<string, string> = {
  'src/index.css': `:root { --brand: #4f46e5; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #18181b;
  background: #fafafa;
}
`,

  'src/App.tsx': `export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 40, color: '#52525b' }}>
      <h1 style={{ color: '#18181b' }}>Context Space</h1>
      <p>Your app will appear here as the agent builds it…</p>
    </div>
  );
}
`,
};
