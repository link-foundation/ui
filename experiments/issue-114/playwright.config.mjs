// Reuse installed Chrome without downloading CI's pinned browser revisions.
import config from '../../playwright.config.mjs';

export default {
  ...config,
  testDir: '../..',
  projects: [
    { name: 'chrome', use: { ...config.projects[0].use, channel: 'chrome' } },
  ],
  workers: 1,
};
