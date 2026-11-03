import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.mjs',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    viewport: { width: 960, height: 640 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
