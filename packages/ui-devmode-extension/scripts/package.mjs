import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
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
const files = {};
for (const file of ['manifest.json', 'background.js', 'devmode.js']) {
  files[file] = await readFile(`${root}/dist/unpacked/${file}`);
}
await writeFile(
  `${root}/dist/ui-devmode-extension.zip`,
  zipSync(files, { level: 6 })
);
console.log(`Extension: ${root}/dist/ui-devmode-extension.zip`);
