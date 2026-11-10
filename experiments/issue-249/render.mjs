/**
 * Writes the default-renderer SVG of `22 11` with the issue 249 fixture and an
 * HTML preview. Usage: node experiments/issue-249/render.mjs [out-dir] [label]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createDoubletProvider,
  doubletGeometry,
} from '../../packages/ui-components/src/links-view/doublet.js';
import { paintedReport } from '../../packages/ui-components/tests/links-view/doublet-painted.js';

const options = await readFile(
  new URL(
    '../../packages/ui-components/tests/links-view/fixtures/doublet-22-11-clean.lino',
    import.meta.url
  ),
  'utf8'
);
const directory = resolve(process.argv[2] ?? '/tmp/issue-249-renderer');
const label = process.argv[3] ?? 'current renderer';
const frame = doubletGeometry(
  [
    [2, 2],
    [1, 1],
  ],
  options
);
const report = paintedReport(frame);
const svg = createDoubletProvider().svg({ frame });
const escape = (text) =>
  text.replace(/[&<>]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'clean-input.svg'), svg);
await writeFile(
  resolve(directory, 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Issue 249 clean input</title><style>body{font:16px sans-serif;margin:16px;background:white;color:#202b3d}svg{width:400px;height:400px;border:1px solid #ccc}pre{font:14px monospace}</style><h1>22 11 · ${escape(label)}</h1><pre>${escape(options)}</pre>${svg}<p>Centreline crossings between links: ${report.crossings.length}; own-half crossings: ${report.ownCrossings.length}; smallest painted gap: ${report.gap.toFixed(3)} box units</p></html>`
);
console.log(JSON.stringify({ transform: frame.transform, ...report }, null, 2));
