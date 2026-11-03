// Local run of the Playwright tests with the Chromium headless shell that is
// already installed (a newer build than the pinned @playwright/test expects),
// to avoid a browser download: npx playwright test -c experiments/playwright-local.config.mjs
import base from '../playwright.config.mjs';

export default {
  ...base,
  testDir: '..',
  webServer: { ...base.webServer, cwd: '..' },
  projects: base.projects
    .filter((p) => p.name === 'chromium')
    .map((p) => ({
      ...p,
      use: {
        ...p.use,
        launchOptions: {
          executablePath:
            process.env.CHROMIUM_PATH ??
            `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
        },
      },
    })),
};
