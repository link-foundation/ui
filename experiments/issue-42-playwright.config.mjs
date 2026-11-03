// Local browser verification with an existing Chrome installation.
import config from '../playwright.config.mjs';
export default {
  ...config,
  testDir: '..',
  projects: [
    {
      name: 'chromium',
      use: {
        ...config.projects[0].use,
        launchOptions: {
          executablePath:
            process.env.NETWORK_CHROME ?? '/opt/google/chrome/chrome',
        },
      },
    },
  ],
};
