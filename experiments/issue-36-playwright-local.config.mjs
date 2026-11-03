// Run the Playwright tests with the system Chrome when the pinned headless
// shell cannot be installed (local runs only; CI uses its container):
// npx playwright test -c experiments/issue-36-playwright-local.config.mjs \
//   packages/ui-components/tests/e2e/layout.spec.js
import base from '../playwright.config.mjs';

export default {
  ...base,
  testDir: '..',
  // Local Chrome screenshots are not baselines: keep them out of the tree.
  snapshotPathTemplate: 'out/issue-36-snapshots/{testFilePath}/{arg}{ext}',
  outputDir: 'out/test-results',
  projects: base.projects
    .filter((p) => p.name === 'chromium')
    .map((p) => ({
      ...p,
      use: {
        ...p.use,
        launchOptions: { executablePath: '/usr/bin/google-chrome' },
      },
    })),
};
