/** Run the Fluent gallery using an installed Chrome, without another browser download. */
import base from '../playwright.config.mjs';
export default {
  ...base,
  testDir: '..',
  outputDir: '../test-results',
  projects: [
    { name: 'chromium', use: { ...base.projects[0].use, channel: 'chrome' } },
  ],
};
