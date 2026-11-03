#!/usr/bin/env node
/**
 * Static server for the Playwright UI tests (playwright.config.mjs).
 *
 * Mounts:
 *   /tests/ui/pages/          -> tests/ui/pages/
 *   /packages/<name>/e2e/pages/ -> packages/<name>/e2e/pages/ (when present)
 *   /example-app/             -> examples/universal-app/dist/
 *   /examples/ui-dom/         -> examples/ui-dom/ (the ui-dom example page)
 *   /packages/<name>/src/     -> packages/<name>/src/ (ES modules of the
 *                                import map of the example pages)
 *   /packages/<name>/examples/ -> packages/<name>/examples/ (when present;
 *                                the ui-components chart gallery)
 *   /node_modules/links-notation/dist/ -> the browser build of links-notation
 *   /node_modules/<d3 package>/ -> the ES modules of d3-scale, d3-shape and
 *                                their dependencies (the chart gallery)
 *   /node_modules/echarts/dist/ -> the optional ECharts build
 *   /node_modules/@dagrejs/dagre/dist/ -> the browser build of Dagre
 *   /node_modules/mermaid/dist/ -> the browser build of Mermaid (the optional
 *                                peer of ui-components, loaded on demand)
 *   /docs/case-studies/issue-1/samples/ -> the sample documents
 *
 * Usage: node scripts/serve-static.mjs [--port 4173] [--host 127.0.0.1]
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startStaticServer } from './lib/static-server.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

/** The npm packages the chart gallery loads as ES modules (no bundler). */
export const BROWSER_MODULES = [
  'd3-array',
  'd3-color',
  'd3-format',
  'd3-interpolate',
  'd3-path',
  'd3-scale',
  'd3-shape',
  'd3-time',
  'd3-time-format',
  'internmap',
];

/**
 * @param {string} root repository root
 * @returns {{prefix: string, dir: string}[]}
 */
export function defaultMounts(root) {
  const mounts = [
    {
      prefix: '/tests/ui/pages/',
      dir: path.join(root, 'tests', 'ui', 'pages'),
    },
    {
      prefix: '/example-app/',
      dir: path.join(root, 'examples', 'universal-app', 'dist'),
    },
  ];
  for (const parts of [
    ['examples', 'ui-dom'],
    ['node_modules', 'links-notation', 'dist'],
    ...BROWSER_MODULES.map((name) => ['node_modules', name]),
    ['node_modules', 'echarts', 'dist'],
    ['node_modules', '@dagrejs', 'dagre', 'dist'],
    ['node_modules', 'mermaid', 'dist'],
    ['docs', 'case-studies', 'issue-1', 'samples'],
  ]) {
    mounts.push({
      prefix: `/${parts.join('/')}/`,
      dir: path.join(root, ...parts),
    });
  }
  const packagesDir = path.join(root, 'packages');
  if (existsSync(packagesDir)) {
    for (const name of readdirSync(packagesDir).sort()) {
      for (const sub of [['e2e', 'pages'], ['src'], ['examples']]) {
        const dir = path.join(packagesDir, name, ...sub);
        if (existsSync(dir)) {
          mounts.push({ prefix: `/packages/${name}/${sub.join('/')}/`, dir });
        }
      }
    }
  }
  return mounts;
}

function parseArgs(argv) {
  const args = { port: 4173, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') {
      args.port = Number(argv[(i += 1)]);
    } else if (argv[i] === '--host') {
      args.host = argv[(i += 1)];
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port, host } = parseArgs(process.argv.slice(2));
  const server = await startStaticServer({
    mounts: defaultMounts(repoRoot),
    port,
    host,
  });
  console.log(`[serve-static] listening on ${server.url}`);
}
