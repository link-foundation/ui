// Local run with the installed browsers (the pinned headless shell build is
// missing here): CHROME=<path to chrome-headless-shell> npx playwright test
// -c experiments/playwright.local.config.mjs <file>
import base from '../playwright.config.mjs';

const launchOptions = process.env.CHROME
  ? { executablePath: process.env.CHROME }
  : {};
export default {
  ...base,
  testDir: '..',
  projects: base.projects.map((p) =>
    p.name === 'chromium' ? { ...p, use: { ...p.use, launchOptions } } : p
  ),
};
