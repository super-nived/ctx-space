/**
 * E2E: verify the in-browser (esm.sh + Babel) live preview renders, styles, and
 * runs a generated app — fast, no npm install.
 * Run: node e2e/preview.spec.mjs   (dev server must be on :5173)
 */
import { chromium } from 'playwright';

const APP = `import { useState } from 'react';
import './index.css';

export default function App() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const add = (e) => { e.preventDefault(); if (text.trim()) { setItems([...items, text]); setText(''); } };
  return (
    <div className="wrap">
      <h1 data-testid="title">My Todos</h1>
      <form onSubmit={add}>
        <input data-testid="todo-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a todo" />
        <button type="submit">Add</button>
      </form>
      <ul>{items.map((it, i) => <li key={i} data-testid="todo-item" className="item">{it}</li>)}</ul>
    </div>
  );
}
`;

const CSS = `.wrap { max-width: 420px; margin: 40px auto; font-family: system-ui; }
h1 { color: rgb(79, 70, 229); }
.item { background: rgb(238, 242, 255); padding: 8px; border-radius: 6px; }
`;

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const t0 = Date.now();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  await page.locator('textarea').first().fill('todo app');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);

  await page.evaluate(
    ({ app, css }) => {
      const s = window.__ctxStore.getState();
      s.setStatus('building');
      s.writeFile('src/index.css', css);
      s.writeFile('src/App.tsx', app);
    },
    { app: APP, css: CSS },
  );

  const frame = page.frameLocator('iframe[title="App preview"]');
  await frame.getByTestId('title').waitFor({ timeout: 30000 });
  const renderMs = Date.now() - t0;
  const title = await frame.getByTestId('title').textContent();
  const titleColor = await frame.getByTestId('title').evaluate((el) => getComputedStyle(el).color);
  console.log(`Rendered in ${renderMs}ms — title=${JSON.stringify(title)} color=${titleColor}`);

  await frame.getByTestId('todo-input').fill('Buy milk');
  await frame.getByRole('button', { name: 'Add' }).click();
  await frame.getByTestId('todo-item').waitFor({ timeout: 10000 });
  const itemBg = await frame.getByTestId('todo-item').evaluate((el) => getComputedStyle(el).backgroundColor);
  const item = await frame.getByTestId('todo-item').textContent();
  console.log(`Added todo=${JSON.stringify(item)} bg=${itemBg}`);

  await page.screenshot({ path: 'e2e-preview-result.png', fullPage: true });
  await browser.close();

  const styled = titleColor === 'rgb(79, 70, 229)' && itemBg === 'rgb(238, 242, 255)';
  const ok = title?.includes('My Todos') && item?.includes('Buy milk') && styled;
  console.log(ok ? '\nPASS — fast preview renders, is STYLED, and interactive.' : '\nFAIL (styled=' + styled + ')');
  process.exit(ok ? 0 : 1);
};

run().catch((e) => {
  console.error('TEST ERROR:', e.message);
  process.exit(1);
});
