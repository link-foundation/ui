import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

// Unlicense npm source releases. Install only the browser dependencies in our
// lockfile: the upstream application also declares unused server/editor plugins.
const releases = [
  [
    'hasura',
    '0.0.68',
    'k+Q5fn+JFGY3w1Avuj/co23zh6Hck4qxXUj+KwFKvsVZHMzrl+KuHoJ9WFas2Eo8LVfpt/5QHzx3cq0ZOC6mgw==',
  ],
  [
    'store',
    '0.0.32',
    'RfmQOJg+t+yAX+AEm6U7xOb2zFMiGfbFYw+/UVaFfsvL8xKXS+SwCHV06jdOvmTPaJ0OCwNnZwWDoX++dJygPA==',
  ],
  [
    'deeplinks',
    '0.0.620',
    'A9IU0SmG3uNc34vtHLAQvEHFrSubr//z8tAIj46vODBIO0udH1qBrsLDUOyhRioDJNsxT81+bcmU9H8YYpeyow==',
  ],
  [
    'react-hasura',
    '0.0.29',
    '9ROqxkj9T38RI7WyTzaGtpTDQXTSPL6Jcm4ADj0RJMEddVkQ6qpJcCDhpTmi7/IhVsnPdJzMC65e3Ss5USJAAQ==',
  ],
  [
    'deepcase',
    '0.0.135',
    'N5WWFCRwD+0bwwG4wqEcUhzUHrtN7NCsMBHiA9SrcR6mrTtCsf5YDrmEkXhW/zacoajjIz1CCFKe/hapM6KKqA==',
  ],
];

export async function prepareUpstream() {
  const directory = resolve('examples/deepcase/dist/upstream/node_modules');
  for (const [name, version, integrity] of releases) {
    const target = `${directory}/@deep-foundation/${name}`;
    const marker = `${target}/.integrity`;
    if ((await readFile(marker, 'utf8').catch(() => '')) === integrity) {
      continue;
    }
    const url = `https://registry.npmjs.org/@deep-foundation/${name}/-/${name}-${version}.tgz`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${url}: ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha512').update(bytes).digest('base64') !== integrity) {
      throw new Error(`Integrity mismatch: ${name}@${version}`);
    }
    await mkdir(target, { recursive: true });
    const archive = `${target}.tgz`;
    await writeFile(archive, bytes);
    await promisify(execFile)('tar', [
      '-xzf',
      archive,
      '--strip-components=1',
      '-C',
      target,
    ]);
    await rm(archive);
    await writeFile(marker, integrity);
  }
  return directory;
}
