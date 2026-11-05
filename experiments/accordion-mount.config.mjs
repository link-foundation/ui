import base from '../playwright.config.mjs';

export default {
  ...base,
  testDir: '.',
  testMatch: 'accordion-mount-animation.e2e.mjs',
  webServer: { ...base.webServer, cwd: '..' },
};
