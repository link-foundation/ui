import { mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new globalThis.URL('..', import.meta.url));
execFileSync(
  process.execPath,
  [`${root}/../ui-devmode/scripts/build-bookmarklet.mjs`],
  { stdio: 'inherit' }
);
await mkdir(`${root}/dist/unpacked`, { recursive: true });
for (const file of ['manifest.json', 'background.js']) {
  await copyFile(`${root}/${file}`, `${root}/dist/unpacked/${file}`);
}
await copyFile(
  `${root}/../ui-devmode/dist/devmode.js`,
  `${root}/dist/unpacked/devmode.js`
);
execFileSync(
  'zip',
  [
    '-q',
    '-X',
    '../ui-devmode-extension.zip',
    'manifest.json',
    'background.js',
    'devmode.js',
  ],
  { cwd: `${root}/dist/unpacked`, stdio: 'inherit' }
);
console.log(`Extension: ${root}/dist/ui-devmode-extension.zip`);
