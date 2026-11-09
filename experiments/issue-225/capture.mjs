import { chromium } from '@playwright/test';
import { URL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: process.env.FRAME_BROWSER ?? '/usr/bin/google-chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1150 },
  });
  await page.goto(
    new URL(
      '../../examples/themes/responsive-frames/dist/index.html',
      import.meta.url
    ).href
  );
  await mkdir(new URL('../../docs/screenshots/issue-225/', import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: new URL(
      '../../docs/screenshots/issue-225/responsive-comparison.png',
      import.meta.url
    ).pathname,
    fullPage: true,
  });
} finally {
  await browser.close();
}
