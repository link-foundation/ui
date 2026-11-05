import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'main.e2e.mjs',
  workers: 1,
  timeout: 30000,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  },
});
