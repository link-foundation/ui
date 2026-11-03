// Screenshot all SVGs of experiments/out/ on one page (light, then dark).
import { readdirSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';

const out = new URL('./out/', import.meta.url);
const mode = process.argv[2] ?? 'light';
const files = readdirSync(out)
  .filter((f) => f.endsWith(`-${mode}.svg`))
  .sort();
const html = files
  .map(
    (f) =>
      `<div style="display:inline-block;margin:4px">${readFileSync(new URL(f, out), 'utf8')}</div>`
  )
  .join('');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
});
const page = await browser.newPage({ viewport: { width: 1340, height: 900 } });
await page.setContent(
  `<body style="margin:0;background:${mode === 'dark' ? '#141218' : '#fff'}">${html}</body>`
);
await page.screenshot({
  path: new URL(`preview-${mode}.png`, out).pathname,
  fullPage: true,
});
await browser.close();
