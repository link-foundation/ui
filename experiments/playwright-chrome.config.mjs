/**
 * The repository Playwright config on the installed Google Chrome
 * (channel "chrome"), for machines without `npx playwright install`.
 * CI uses the pinned container and playwright.config.mjs.
 */
import base from '../playwright.config.mjs';

export default {
  ...base,
  testDir: '..',
  projects: [
    {
      name: 'chrome',
      use: { ...base.projects[0].use, channel: 'chrome' },
    },
  ],
};
