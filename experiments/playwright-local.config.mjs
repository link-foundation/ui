// Local runs only: the shared config with the Chromium build installed on
// this machine (its revision differs from the one @playwright/test expects).
// Usage: npx playwright test -c experiments/playwright-local.config.mjs \
//          packages/ui-dom/e2e --project=chromium
import { homedir } from 'node:os';
import { join } from 'node:path';
import base from '../playwright.config.mjs';

const executablePath = join(
  homedir(),
  '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'
);

export default {
  ...base,
  testDir: '..',
  webServer: { ...base.webServer, cwd: '..' },
  outputDir: '../test-results',
  projects: base.projects.map((project) => ({
    ...project,
    use: { ...project.use, launchOptions: { executablePath } },
  })),
};
