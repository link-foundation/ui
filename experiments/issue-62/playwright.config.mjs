// Local resource-saving browser verification with the preinstalled Chrome.
import { defineConfig } from '@playwright/test';
import shared from '../../playwright.config.mjs';
export default defineConfig({
  ...shared,
  testDir: '../..',
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
