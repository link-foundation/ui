/* global URL */
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import config from '../playwright.config.mjs';

// Use a full Chromium installation when the headless shell is unavailable.
export default {
  ...config,
  testDir: '..',
  webServer: {
    ...config.webServer,
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  },
  outputDir: '../test-results',
  projects: config.projects.map((project) => ({
    ...project,
    use: {
      ...project.use,
      ...(project.name === 'chromium' && process.env.MATERIAL3_CHROMIUM
        ? { launchOptions: { executablePath: process.env.MATERIAL3_CHROMIUM } }
        : {}),
    },
  })),
};
