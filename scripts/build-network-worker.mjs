#!/usr/bin/env node
/** Bundle pinned layout dependencies: browser workers cannot use import maps. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function buildNetworkWorker(
  root = fileURLToPath(new globalThis.URL('../', import.meta.url))
) {
  await build({
    entryPoints: [
      resolve(
        root,
        'packages/ui-components/src/links-view/layout-worker-entry.mjs'
      ),
    ],
    outfile: resolve(
      root,
      'packages/ui-components/dist/network-layout.worker.mjs'
    ),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    minify: true,
    legalComments: 'inline',
    banner: {
      js: '// Bundled layout worker: d3-force and dependencies (ISC), Dagre (MIT). See network-layout-NOTICE.md.',
    },
  });
  const { mkdir, copyFile, writeFile } = await import('node:fs/promises');
  const directory = resolve(root, 'packages/ui-components/dist');
  await mkdir(directory, { recursive: true });
  for (const [name, directoryName] of [
    ['d3-force', 'd3-force'],
    ['d3-dispatch', 'd3-dispatch'],
    ['d3-quadtree', 'd3-quadtree'],
    ['d3-timer', 'd3-timer'],
    ['dagre', '@dagrejs/dagre'],
  ]) {
    await copyFile(
      resolve(root, 'node_modules', directoryName, 'LICENSE'),
      resolve(directory, `network-layout-${name}-LICENSE.txt`)
    );
  }
  await writeFile(
    resolve(directory, 'network-layout-NOTICE.md'),
    '# Layout worker dependencies\n\nBundled from pinned npm dependencies: d3-force 3.0.0, d3-dispatch,\nd3-quadtree and d3-timer (ISC); @dagrejs/dagre 3.1.3 (MIT).\nTheir copyright and license notices accompany this worker as\nnetwork-layout-*-LICENSE.txt. Repository code is Unlicense.\n'
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildNetworkWorker();
}
