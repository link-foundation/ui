import { URL } from 'node:url';
import config from '../../playwright.config.mjs';
export default {
  ...config,
  testDir: '../..',
  webServer: {
    ...config.webServer,
    cwd: new URL('../..', import.meta.url).pathname,
  },
  projects: config.projects
    .filter((project) => ['chromium', 'webkit'].includes(project.name))
    .map((project) => ({
      ...project,
      use: {
        ...project.use,
        ...(project.name === 'chromium' && process.env.ACTIVITY_CHROMIUM
          ? { launchOptions: { executablePath: process.env.ACTIVITY_CHROMIUM } }
          : {}),
      },
    })),
};
