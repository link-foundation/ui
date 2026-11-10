/** Bounded renderer-only probe for issue 228's specified clean input. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  doubletGeometry,
  createDoubletProvider,
} from '../../packages/ui-components/src/links-view/doublet.js';
import { cubicPoint } from '../../packages/ui-components/src/links-view/geometry.js';

const links = [
  [2, 2],
  [1, 1],
];
const options = 'link 1\n  turns -90 90\nlink 2\n  turns -90 90\n';
const frame = doubletGeometry(links, options);
const steps = 256;
const samples = frame.curves.map((curve) =>
  curve.visible.map((segment) =>
    segment
      ? Array.from({ length: steps + 1 }, (_, i) =>
          cubicPoint(segment, i / steps)
        )
      : []
  )
);
const cross = (x, y) => x.x * y.y - x.y * y.x;
const sub = (x, y) => ({ x: x.x - y.x, y: x.y - y.y });
const intersections = [];
for (let a = 0; a < 2; a++) {
  for (let b = 0; b < 2; b++) {
    const first = samples[0][a],
      second = samples[1][b];
    for (let i = 1; i < first.length; i++) {
      for (let j = 1; j < second.length; j++) {
        const p = first[i - 1],
          q = second[j - 1];
        const u = sub(first[i], p),
          v = sub(second[j], q),
          w = sub(q, p);
        const denominator = cross(u, v);
        if (Math.abs(denominator) < 1e-12) {
          continue;
        }
        const t = cross(w, v) / denominator,
          s = cross(w, u) / denominator;
        if (t > 0 && t < 1 && s > 0 && s < 1) {
          intersections.push({
            halves: [a, b],
            x: p.x + t * u.x,
            y: p.y + t * u.y,
          });
        }
      }
    }
  }
}
const provider = createDoubletProvider();
const svg = provider.svg({ frame });
const directory = resolve(process.argv[2] ?? '/tmp/issue-228-renderer');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'clean-input.svg'), svg);
await writeFile(
  resolve(directory, 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Issue 228 clean-input renderer probe</title><style>body{font:16px sans-serif;margin:24px;background:white;color:#202b3d}svg{width:480px;height:480px;border:1px solid #ccc}pre{font:16px monospace}</style><h1>22 11 with turns -90 90 on both links</h1><p>Default doublet renderer: ${intersections.length} visible centreline crossings.</p>${svg}<pre>${JSON.stringify(intersections, null, 2)}</pre></html>`
);
console.log(
  JSON.stringify(
    {
      links,
      options,
      transform: frame.transform,
      samplesPerHalf: steps,
      intersections,
    },
    null,
    2
  )
);
