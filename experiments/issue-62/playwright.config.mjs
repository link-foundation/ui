// Local resource-saving browser verification with the preinstalled Chrome.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import shared from '../../playwright.config.mjs';
export default defineConfig({
  ...shared,
  testDir: '../..',
  webServer: {
    ...shared.webServer,
    cwd: fileURLToPath(new globalThis.URL('../..', import.meta.url)),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...shared.projects[0].use,
        launchOptions: { executablePath: '/opt/google/chrome/chrome' },
      },
    },
  ],
});
