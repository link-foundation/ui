/**
 * Local runs only: the repository config with the full Chromium build
 * (channel 'chromium', new headless mode), for machines that have it but
 * not chrome-headless-shell. CI uses playwright.config.mjs as is.
 *
 *   npx playwright test -c experiments/playwright.local.config.mjs \
 *     packages/ui-components/tests/e2e/diagrams.spec.js
 */
import base from '../playwright.config.mjs';

export default {
  ...base,
  testDir: '..',
  outputDir: '../test-results',
  webServer: { ...base.webServer, cwd: '..' },
  projects: [
    {
      name: 'chromium',
      use: { ...base.projects[0].use, channel: 'chromium' },
    },
  ],
};
