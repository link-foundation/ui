// Run against scripts/serve-static.mjs on port 4173.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  ...(process.env.ISSUE_230_CHROMIUM
    ? { executablePath: process.env.ISSUE_230_CHROMIUM }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1100 },
  });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/examples/network-editor.html'
  );
  await page.waitForFunction(() => globalThis.networkEditorExample);
  await mkdir('docs/screenshots/issue-230', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/issue-230/editor.png' });
} finally {
  await browser.close();
}
