// Reuse an installed Chrome for focused checks without downloading browsers.
// CHROME_EXECUTABLE=/opt/google/chrome/chrome npx playwright test --config experiments/ui-devmode-local.config.mjs
import { fileURLToPath } from 'node:url';
import config from '../playwright.config.mjs';

export default {
  ...config,
  testDir: fileURLToPath(new globalThis.URL('../', import.meta.url)),
  testMatch: 'packages/ui-devmode/e2e/*.e2e.mjs',
  webServer: {
    ...config.webServer,
    cwd: fileURLToPath(new globalThis.URL('../', import.meta.url)),
  },
  projects: [
    {
      ...config.projects[0],
      use: {
        ...config.projects[0].use,
        launchOptions: {
          executablePath:
            process.env.CHROME_EXECUTABLE || '/opt/google/chrome/chrome',
        },
      },
    },
  ],
};
