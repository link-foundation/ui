/* global URL */
// Local low-disk verification against the installed browser; CI uses the root config.
import config from '../../playwright.config.mjs';
import { fileURLToPath } from 'node:url';
export default {
  ...config,
  testDir: fileURLToPath(new URL('../../', import.meta.url)),
  outputDir: fileURLToPath(new URL('../../test-results', import.meta.url)),
  reporter: [['list']],
  projects: [
    {
      ...config.projects[0],
      use: {
        ...config.projects[0].use,
        launchOptions: { executablePath: '/opt/google/chrome/chrome' },
      },
    },
  ],
};
