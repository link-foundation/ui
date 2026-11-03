#!/usr/bin/env node
// Draw the own icon set (assets/icons/own/*.svg) from geometric primitives
// on a 24×24 grid with a 2 px round stroke. Every shape below is written
// from scratch (lines, arcs, circles and rectangles); nothing is traced or
// copied from another icon set. The files are dedicated to the public
// domain under CC0-1.0 (see assets/assets.lino).
//
//   node experiments/icons/draw-own-icons.mjs [out-dir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'assets/icons/own';

const r2 = (n) => Number(n.toFixed(2));
const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r2(12 + r * Math.cos(a)), r2(12 + r * Math.sin(a))];
};

/** An eight-tooth gear: teeth at radius 9, valleys at radius 7. */
function gear() {
  const parts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = i * 45;
    const points = [
      polar(7, a - 15),
      polar(9, a - 8),
      polar(9, a + 8),
      polar(7, a + 15),
    ];
    // The previous valley arc already ends at points[0].
    if (i === 0) {
      parts.push(`M${points[0].join(' ')}`);
    }
    parts.push(...points.slice(1).map((p) => `L${p.join(' ')}`));
    const next = polar(7, a + 30);
    parts.push(`A7 7 0 0 1 ${next.join(' ')}`);
  }
  return `${parts.join('')}Z`;
}

const frame = '<rect x="3" y="4" width="18" height="16" rx="2"/>';
const lens =
  '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>';
const dot = (cx, cy, r = 1) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

/** @type {Record<string, string>} logical name → SVG body */
const ICONS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  more: dot(5, 12, 1.75) + dot(12, 12, 1.75) + dot(19, 12, 1.75),
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: lens,
  settings: `<path d="${gear()}"/><circle cx="12" cy="12" r="3"/>`,
  reset: '<path d="M5 12a7 7 0 1 0 2.05-4.95L5 9"/><path d="M5 4v5h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  paste:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h4"/>',
  send: '<path d="M20.5 3.5L3.5 10.5l7 3 3 7z"/><path d="M20.5 3.5l-10 10"/>',
  attach:
    '<path d="M16.5 7.5v9a4.5 4.5 0 0 1-9 0V6a3 3 0 0 1 6 0v10a1.5 1.5 0 0 1-3 0V8"/>',
  'drag-handle':
    dot(9, 6, 1.25) +
    dot(15, 6, 1.25) +
    dot(9, 12, 1.25) +
    dot(15, 12, 1.25) +
    dot(9, 18, 1.25) +
    dot(15, 18, 1.25),
  'dock-left': `${frame}<path d="M9 4v16"/>`,
  'dock-right': `${frame}<path d="M15 4v16"/>`,
  'dock-bottom': `${frame}<path d="M3 14h18"/>`,
  float: `${frame}<rect x="11" y="10" width="7" height="6" rx="1"/>`,
  'zoom-in': `${lens}<path d="M8 10.5h5M10.5 8v5"/>`,
  'zoom-out': `${lens}<path d="M8 10.5h5"/>`,
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause:
    '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  record: '<circle cx="12" cy="12" r="7" fill="currentColor"/>',
  warning: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  link: '<path d="M10 8H7a4 4 0 0 0 0 8h3M14 8h3a4 4 0 0 1 0 8h-3M8 12h8"/>',
};

const ROOT =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

mkdirSync(out, { recursive: true });
for (const [name, body] of Object.entries(ICONS)) {
  writeFileSync(join(out, `${name}.svg`), `<svg ${ROOT}>${body}</svg>\n`);
}
console.log(`Wrote ${Object.keys(ICONS).length} icons to ${out}`);
