// CHROME=/path/to/chrome node experiments/issue-224/capture.mjs
import { mkdir } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { defaultMounts } from '../../scripts/serve-static.mjs';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await startStaticServer({ mounts: defaultMounts(root) });
const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  await page.goto(`${server.url}examples/animation/backgrounds/`);
  await page.locator('html[data-backgrounds-ready="true"]').waitFor();
  await mkdir(new URL('../../docs/screenshots', import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: fileURLToPath(
      new URL('../../docs/screenshots/background-layers.png', import.meta.url)
    ),
  });
} finally {
  await browser.close();
  await server.close();
}
