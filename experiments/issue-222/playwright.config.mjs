// Bounded local verification with the installed Chrome; CI uses pinned browsers.
import base from '../../playwright.config.mjs';
export default {
  ...base,
  testDir: '../..',
  testMatch: ['packages/ui-sound/e2e/sound.e2e.mjs'],
  projects: [
    { name: 'chromium', use: { ...base.projects[0].use, channel: 'chrome' } },
  ],
  workers: 1,
  webServer: undefined,
};
