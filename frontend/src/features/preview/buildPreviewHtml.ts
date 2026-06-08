/**
 * Builds a self-contained HTML document that runs the agent-generated React app
 * entirely in the browser — no npm install, no bundler server. Strategy:
 *   - bare imports (react, react-dom, lucide-react, …) -> https://esm.sh/<pkg>
 *   - relative imports (./App, ./components/Foo) -> resolved against the virtual
 *     FS and rewritten to blob: module URLs
 *   - .tsx/.ts/.jsx are transpiled in-browser with @babel/standalone
 *   - .css files are collected and injected as <style>
 *
 * The result renders in ~1-2s and is reliable on slow networks (CDN-cached),
 * which is why we use it instead of an in-browser npm install.
 */
import type { ProjectFile } from '@/types/project';

const ESM_CDN = 'https://esm.sh';

/** Candidate entry files, in priority order. */
const ENTRY_CANDIDATES = [
  'src/main.tsx',
  'src/main.jsx',
  'src/index.tsx',
  'src/index.jsx',
  'src/App.tsx',
  'src/App.jsx',
  'App.tsx',
];

const CODE_EXT = /\.(tsx|ts|jsx|js)$/;

function stripExt(path: string): string {
  return path.replace(CODE_EXT, '').replace(/\.css$/, '');
}

/** Resolve a relative import (from `fromPath`) to a key in the file map. */
function resolveRelative(
  fromPath: string,
  spec: string,
  files: Record<string, string>,
): string | null {
  const baseDir = fromPath.split('/').slice(0, -1);
  const parts = spec.split('/');
  const stack = [...baseDir];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    else if (p === '..') stack.pop();
    else stack.push(p);
  }
  const target = stack.join('/');
  const candidates = [
    target,
    `${target}.tsx`,
    `${target}.ts`,
    `${target}.jsx`,
    `${target}.js`,
    `${target}/index.tsx`,
    `${target}/index.ts`,
    `${target}/index.jsx`,
    `${target}/index.js`,
    `${target}.css`,
  ];
  return candidates.find((c) => c in files) ?? null;
}

/**
 * Rewrite import/export specifiers in a module:
 *   - relative -> the resolved virtual path (kept as a placeholder the loader maps)
 *   - bare     -> esm.sh URL
 */
function rewriteSpecifiers(
  code: string,
  fromPath: string,
  files: Record<string, string>,
): string {
  // Matches: import ... from '...'  |  import '...'  |  export ... from '...'
  const re = /((?:import|export)\b[^'"]*?\bfrom\s*|import\s*)(['"])([^'"]+)(\2)/g;
  return code.replace(re, (full, pre, q, spec) => {
    // Already-resolved specifiers (CDN URLs or virtual paths) pass through.
    if (spec.startsWith('http') || spec.startsWith('@vfs/')) {
      return full;
    }
    if (spec.startsWith('.') || spec.startsWith('/')) {
      const resolved = resolveRelative(fromPath, spec, files);
      if (!resolved) return full; // leave unresolved; will surface as a runtime error
      if (resolved.endsWith('.css')) {
        // CSS is injected globally; drop the import so it doesn't error.
        return `${pre}${q}data:text/javascript,${q}`;
      }
      return `${pre}${q}@vfs/${stripExt(resolved)}${q}`;
    }
    // react / react-dom are provided by the import map (so Babel's emitted
    // "react/jsx-runtime" resolves the same way) — leave them bare.
    if (
      spec === 'react' ||
      spec === 'react-dom' ||
      spec.startsWith('react/') ||
      spec.startsWith('react-dom/')
    ) {
      return full;
    }
    // Other bare imports -> CDN, but pin react/react-dom as EXTERNAL so the
    // package shares our single React instance (otherwise libraries like
    // lucide-react bundle their own React and hooks break -> blank render).
    return `${pre}${q}${ESM_CDN}/${spec}?external=react,react-dom${q}`;
  });
}

export interface PreviewBuild {
  html: string;
  entry: string | null;
}

/**
 * Produce the full HTML document. Modules are emitted as an importmap of blob
 * URLs keyed by `@vfs/<path>`, transpiled by Babel inside the iframe at load.
 */
export function buildPreviewHtml(fileList: ProjectFile[]): PreviewBuild {
  const files: Record<string, string> = {};
  for (const f of fileList) files[f.path] = f.contents;

  let entry = ENTRY_CANDIDATES.find((c) => c in files) ?? null;

  // If the only entry is an App component (no main/index that calls render),
  // synthesize a bootstrap module that mounts it.
  const isAppEntry = entry !== null && /(^|\/)App\.(t|j)sx?$/.test(entry);
  const hasRealEntry =
    'src/main.tsx' in files ||
    'src/main.jsx' in files ||
    'src/index.tsx' in files ||
    'src/index.jsx' in files;
  if (entry && isAppEntry && !hasRealEntry) {
    const appSpec = `@vfs/${stripExt(entry)}`;
    files['__bootstrap__.tsx'] = `import { createRoot } from 'react-dom/client';
import React from 'react';
import App from '${appSpec}';
createRoot(document.getElementById('root')).render(React.createElement(App));
`;
    entry = '__bootstrap__.tsx';
  }

  // Collect CSS. Strip Tailwind at-rules (@tailwind / @apply / @layer) — they are
  // not valid plain CSS; Tailwind utility classes are handled by the Play CDN
  // injected in <head>, so the agent can use either Tailwind classes OR plain CSS.
  const css = Object.entries(files)
    .filter(([p]) => p.endsWith('.css'))
    .map(([, c]) => c)
    .join('\n')
    .replace(/@tailwind[^;]*;/g, '')
    .replace(/@layer[^{]*\{[\s\S]*?\}/g, '')
    .replace(/@apply[^;]*;/g, '');

  // Rewrite + collect code modules (raw TSX — Babel runs in the iframe).
  const modules: Record<string, string> = {};
  for (const [path, code] of Object.entries(files)) {
    if (!CODE_EXT.test(path)) continue;
    modules[`@vfs/${stripExt(path)}`] = rewriteSpecifiers(code, path, files);
  }

  const entrySpecifier = entry ? `@vfs/${stripExt(entry)}` : null;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <!-- Tailwind Play CDN: compiles utility classes (bg-indigo-600, flex, …) in
         the browser, incl. classes added by React after mount (MutationObserver).
         Lets generated apps use Tailwind OR plain CSS and both render. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>${css}</style>
    <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script>
      // Forward runtime errors to the parent for the self-healing loop.
      window.onerror = (msg, src, line, col) => {
        parent.postMessage({ __ctxPreviewError: { message: String(msg), line } }, '*');
      };
      window.addEventListener('unhandledrejection', (e) => {
        parent.postMessage({ __ctxPreviewError: { message: String(e.reason) } }, '*');
      });
    </script>
    <script>
      const RAW = ${JSON.stringify(modules)};
      const ENTRY = ${JSON.stringify(entrySpecifier)};
      // Transpile each virtual module with Babel, turn it into a blob URL, and
      // build an import map so relative @vfs/* imports resolve to those blobs.
      const urls = {};
      const order = Object.keys(RAW);
      try {
        for (const key of order) {
          const out = Babel.transform(RAW[key], {
            presets: [['react', { runtime: 'automatic' }], 'typescript'],
            filename: key + '.tsx',
          }).code;
          urls[key] = URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
        }
        // Build the import map: @vfs/* -> blob URLs, plus base packages so
        // Babel's emitted imports (e.g. "react/jsx-runtime") resolve to the CDN.
        const CDN = ${JSON.stringify(ESM_CDN)};
        // Pin one React version so every CDN package (loaded with ?external=react)
        // resolves to the SAME React instance — avoids duplicate-React hook errors.
        const map = {
          imports: {
            'react': CDN + '/react@18.3.1',
            'react/': CDN + '/react@18.3.1/',
            'react-dom': CDN + '/react-dom@18.3.1',
            'react-dom/': CDN + '/react-dom@18.3.1/',
          },
        };
        for (const key of order) map.imports[key] = urls[key];
        const im = document.createElement('script');
        im.type = 'importmap';
        im.textContent = JSON.stringify(map);
        document.head.appendChild(im);

        if (ENTRY) {
          // Import via the mapped specifier so its internal @vfs imports resolve.
          const s = document.createElement('script');
          s.type = 'module';
          s.textContent = 'import ' + JSON.stringify(ENTRY) + ';';
          document.body.appendChild(s);
        } else {
          document.getElementById('root').innerHTML =
            '<p style="font-family:system-ui;padding:24px;color:#a1a1aa">No entry file yet.</p>';
        }
        parent.postMessage({ __ctxPreviewReady: true }, '*');
      } catch (err) {
        parent.postMessage({ __ctxPreviewError: { message: String(err && err.message || err) } }, '*');
        document.getElementById('root').innerHTML =
          '<pre style="font-family:ui-monospace;padding:16px;color:#b91c1c;white-space:pre-wrap">' +
          String(err && err.message || err) + '</pre>';
      }
    </script>
  </body>
</html>`;

  return { html, entry };
}
