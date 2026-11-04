import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.mjs';
export default defineConfig({
  ...base,
  testDir: '../..',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
  },
  testMatch: ['tests/ui/store-links.e2e.mjs'],
  projects: [
    {
      name: 'chrome-local',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: '/usr/bin/google-chrome',
          args: ['--no-sandbox'],
        },
      },
    },
  ],
  workers: 1,
});
