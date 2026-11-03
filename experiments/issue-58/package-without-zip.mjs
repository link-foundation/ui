// Reproduce the Playwright container's missing system zip executable.
import { execFileSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';

execFileSync(
  process.execPath,
  [
    fileURLToPath(
      new URL(
        '../../packages/ui-devmode-extension/scripts/package.mjs',
        import.meta.url
      )
    ),
  ],
  { env: { ...process.env, PATH: '' }, stdio: 'inherit' }
);
