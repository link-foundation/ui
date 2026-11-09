// Reuse cached browsers when the pinned CI revisions are unavailable locally.
// CHROME=/path/to/chrome WEBKIT=/path/to/pw_run.sh npx playwright test \
//   -c experiments/issue-224/playwright.config.mjs --workers=1
import base from '../../playwright.config.mjs';
export default {
  ...base,
  testDir: '../..',
  testMatch: 'tests/ui/backgrounds.e2e.mjs',
  outputDir: '../../test-results',
  webServer: { ...base.webServer, cwd: '../..' },
  projects: base.projects
    .filter((project) => ['chromium', 'webkit'].includes(project.name))
    .map((project) => {
      const executablePath =
        project.name === 'chromium' ? process.env.CHROME : process.env.WEBKIT;
      return {
        ...project,
        use: {
          ...project.use,
          launchOptions: executablePath ? { executablePath } : {},
        },
      };
    }),
};
