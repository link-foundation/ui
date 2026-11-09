/**
 * Shared Playwright Test configuration for visual regression and
 * accessibility tests. See docs/testing-ui.md.
 *
 * Test files use the `.e2e.mjs` suffix so `node --test`, `bun test` and
 * `deno test` never pick them up. Cross-package browser tests live in
 * `tests/e2e/*.spec.js`, a package's own browser tests in
 * `packages/<pkg>/tests/e2e/*.spec.js`; bunfig.toml keeps them out of
 * `bun test`.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: '.',
  testMatch: [
    'tests/ui/**/*.e2e.mjs',
    'packages/*/e2e/**/*.e2e.mjs',
    'tests/e2e/**/*.spec.js',
    'packages/*/tests/e2e/**/*.spec.js',
  ],
  testIgnore: ['**/node_modules/**'],
  // Baselines live next to the tests that own them:
  //   tests/ui/__screenshots__/<project>/<file>/<name>.png
  //   packages/<pkg>/e2e/__screenshots__/<project>/<file>/<name>.png
  snapshotPathTemplate:
    '{testFileDir}/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      // Per-pixel colour tolerance (pixelmatch YIQ). The default 0.2 lets a
      // hue change of similar brightness pass; baselines come from one pinned
      // container, so a strict value stays stable.
      threshold: 0.05,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'firefox',
      testMatch: 'packages/ui-themes/e2e/optical-materials.e2e.mjs',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs --port ${PORT}`,
    url: `${BASE_URL}tests/ui/pages/smoke.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
