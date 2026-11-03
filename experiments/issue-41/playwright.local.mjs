/**
 * Runs the e2e specs with the locally installed Chromium (a newer revision
 * than the one the pinned Playwright expects). Screenshot baselines come
 * from `npm run test:ui:docker`; this config is for local checks only.
 */
import base from '../../playwright.config.mjs';

const executablePath = process.env.CHROMIUM_PATH;

export default {
  ...base,
  testDir: '../..',
  outputDir: '../../test-results',
  webServer: { ...base.webServer, cwd: '../..' },
  projects: [
    {
      name: 'chromium-local',
      use: {
        ...base.projects?.find((p) => p.name === 'chromium')?.use,
        launchOptions: { executablePath },
      },
    },
  ],
};
