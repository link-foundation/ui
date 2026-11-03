import config from '../../playwright.config.mjs';
// Set this to reuse an installed Chromium without another browser download.
const executablePath = process.env.UI_DEVMODE_CHROMIUM_EXECUTABLE;
export default {
  ...config,
  webServer: { ...config.webServer, cwd: process.cwd() },
  testDir: '../..',
  projects: [
    {
      ...config.projects[0],
      use: { ...config.projects[0].use, launchOptions: { executablePath } },
    },
  ],
};
