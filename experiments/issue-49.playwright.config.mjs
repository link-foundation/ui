/** Run the Fluent gallery using an installed Chrome, without another browser download. */
/* global URL */
import { fileURLToPath } from 'node:url';
import base from '../playwright.config.mjs';
export default {
  ...base,
  testDir: '..',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  },
  outputDir: '../test-results',
  projects: [
    { name: 'chromium', use: { ...base.projects[0].use, channel: 'chrome' } },
  ],
};
