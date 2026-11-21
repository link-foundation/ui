#!/usr/bin/env node
/** Bundle worker dependencies because browser workers cannot use import maps. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function buildNetworkWorker(
  root = fileURLToPath(new globalThis.URL('../', import.meta.url))
) {
  await build({
    entryPoints: {
      'network-layout.worker': resolve(
        root,
        'packages/ui-components/src/links-view/layout-worker-entry.mjs'
      ),
      'network-collision.worker': resolve(
        root,
        'packages/ui-components/src/links-view/collision-worker-entry.mjs'
      ),
    },
    outdir: resolve(root, 'packages/ui-components/dist'),
    outExtension: { '.js': '.mjs' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    minify: true,
    legalComments: 'inline',
    banner: {
      js: '// See network-layout-NOTICE.md for bundled dependency licenses.',
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
    '# Network worker dependencies\n\nThe layout and collision workers bundle d3-force 3.0.0, d3-dispatch,\nd3-quadtree and d3-timer (ISC), and @dagrejs/dagre 3.1.3 (MIT).\nTheir copyright and license notices are in network-layout-*-LICENSE.txt.\nThe collision worker also bundles links-notation (Unlicense).\nRepository code is Unlicense.\n'
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildNetworkWorker();
}
