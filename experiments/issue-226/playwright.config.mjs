import { fileURLToPath } from 'node:url';
import base from '../../playwright.config.mjs';

// Focused cross-engine contract checks; no full application builds are needed.
export default {
  ...base,
  testDir: fileURLToPath(new globalThis.URL('../../', import.meta.url)),
  testMatch: 'packages/ui-themes/e2e/optical-materials.e2e.mjs',
  workers: 1,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: { ...base.webServer, cwd: process.cwd() },
};
