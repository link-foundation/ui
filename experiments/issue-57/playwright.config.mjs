// Use the installed browser for bounded local validation; CI uses pinned browsers.
import base from '../../playwright.config.mjs';
export default {
  ...base,
  testDir: '../..',
  projects: [
    { name: 'chromium', use: { ...base.projects[0].use, channel: 'chrome' } },
  ],
  workers: 1,
};
