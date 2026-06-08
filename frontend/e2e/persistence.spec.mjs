/**
 * E2E: verify project state (files, edits, name) survives a page refresh.
 * Run: node e2e/persistence.spec.mjs   (dev server must be on :5173)
 */
import { chromium } from 'playwright';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  // Create a project and write a file (as the agent would).
  await page.locator('textarea').first().fill('todo app');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const s = window.__ctxStore.getState();
    s.setProjectName('My Persisted App');
    s.writeFile('src/App.tsx', 'export default () => <h1>Persisted</h1>;');
    s.writeFile('src/util.ts', 'export const x = 1;');
  });

  const before = await page.evaluate(() => {
    const s = window.__ctxStore.getState();
    return { name: s.projectName, files: Object.keys(s.files), edits: s.edits.length };
  });
  console.log('Before refresh:', before);

  // Refresh.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const after = await page.evaluate(() => {
    const s = window.__ctxStore.getState();
    return { name: s.projectName, files: Object.keys(s.files), edits: s.edits.length };
  });
  console.log('After refresh: ', after);

  // We should still be in the workspace (not bounced to landing).
  const inWorkspace = (await page.locator('text=Preview').count()) > 0;
  console.log('Still in workspace after refresh:', inWorkspace);

  await browser.close();

  const ok =
    inWorkspace &&
    after.name === 'My Persisted App' &&
    after.files.includes('src/App.tsx') &&
    after.files.includes('src/util.ts') &&
    after.edits === before.edits;
  console.log(ok ? '\nPASS — project persists across refresh.' : '\nFAIL');
  process.exit(ok ? 0 : 1);
};

run().catch((e) => {
  console.error('TEST ERROR:', e.message);
  process.exit(1);
});
