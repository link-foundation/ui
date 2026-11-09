import { URL } from 'node:url';
import config from '../../playwright.config.mjs';
export default {
  ...config,
  testDir: '../..',
  snapshotPathTemplate: decodeURIComponent(
    new URL(
      '../../packages/ui-themes/tests/e2e/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
      import.meta.url
    ).pathname
  ),
  webServer: {
    ...config.webServer,
    cwd: new URL('../..', import.meta.url).pathname,
  },
  projects: config.projects.map((project) => ({
    ...project,
    use: {
      ...project.use,
      launchOptions:
        project.name === 'chromium'
          ? {
              executablePath:
                process.env.FRAME_BROWSER ?? '/usr/bin/google-chrome',
            }
          : {},
    },
  })),
};
