/**
 * Bounded painted-geometry probe for issue 249: counts proper crossings of the
 * visible centrelines (between links, and between a link's own halves outside
 * the joint radius) and the smallest painted gap between different links,
 * including marker outlines, miter tips and filled dots.
 * Usage: node experiments/issue-249/painted-check.mjs [options-file]
 */
import { readFile } from 'node:fs/promises';
import { doubletGeometry } from '../../packages/ui-components/src/links-view/doublet.js';
import { paintedReport } from '../../packages/ui-components/tests/links-view/doublet-painted.js';

const links = [
  [2, 2],
  [1, 1],
];
const fixture = new URL(
  '../../packages/ui-components/tests/links-view/fixtures/doublet-22-11-clean.lino',
  import.meta.url
);
const options = await readFile(process.argv[2] ?? fixture, 'utf8');
const variants = {
  fixture: options,
  defaults: '',
  'both links -90 90': 'link 1\n  turns -90 90\nlink 2\n  turns -90 90\n',
};
for (const [name, text] of Object.entries(variants)) {
  const frame = doubletGeometry(links, text);
  console.log(name, JSON.stringify(paintedReport(frame)));
}
