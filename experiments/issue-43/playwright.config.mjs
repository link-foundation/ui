// Local verification uses the installed browser; CI uses the pinned browsers.
import { URL } from 'node:url';
import config from '../../playwright.config.mjs';
export default {
  ...config,
  testDir: '../..',
  webServer: {
    ...config.webServer,
    cwd: new URL('../../', import.meta.url).pathname,
  },
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        ...config.projects[0].use,
        launchOptions: { executablePath: '/opt/google/chrome/chrome' },
      },
    },
  ],
};
