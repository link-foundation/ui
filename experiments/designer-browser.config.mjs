/** Resource-light local designer checks using an installed Chrome browser. */
import base from '../playwright.config.mjs';
import { URL } from 'node:url';
export default {
  ...base,
  testDir: '..',
  outputDir: new URL('../test-results/', import.meta.url).pathname,
  reporter: [['list']],
  webServer: {
    ...base.webServer,
    cwd: new URL('../', import.meta.url).pathname,
  },
  projects: [
    { name: 'chromium', use: { ...base.projects[0].use, channel: 'chrome' } },
  ],
};
