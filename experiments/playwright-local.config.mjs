// Local run with the cached Chromium build when the pinned one is missing:
// npx playwright test -c experiments/playwright-local.config.mjs tests/e2e
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import base from '../playwright.config.mjs';

const cache = join(homedir(), '.cache/ms-playwright');
const dir = readdirSync(cache).find((d) => /^chromium-\d+$/.test(d));
const sub = readdirSync(join(cache, dir)).find((d) => d.startsWith('chrome-'));

export default {
  ...base,
  testDir: '..',
  webServer: { ...base.webServer, cwd: '..' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...base.projects[0].use,
        launchOptions: { executablePath: join(cache, dir, sub, 'chrome') },
      },
    },
  ],
};
