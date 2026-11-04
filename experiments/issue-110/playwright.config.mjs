// Use the installed Chrome for a bounded local check; CI uses the pinned browsers.
import { fileURLToPath, URL } from 'node:url';
import config from '../../playwright.config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export default {
  ...config,
  testDir: root,
  testMatch: 'tests/ui/links-websocket.e2e.mjs',
  workers: 1,
  projects: [
    { name: 'chromium', use: { ...config.projects[0].use, channel: 'chrome' } },
  ],
  webServer: { ...config.webServer, cwd: root },
};
