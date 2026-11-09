import { URL } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  readFrames,
  framesCss,
  frameLayers,
  frameGeometry,
  resolveFrame,
} from '../../../packages/ui-themes/src/classic/frames.js';

const source = await readFile(
  new URL('./frames.lino', import.meta.url),
  'utf8'
);
const frames = readFrames(source);
const chunks = framesCss(frames);
const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(
  new URL('frames.css', output),
  [
    chunks.properties,
    chunks.base,
    ...Object.values(chunks.levels),
    chunks.fit,
  ].join('\n')
);
const layers = frameLayers();
const fixed = frameGeometry(resolveFrame(frames, 'panel'), 320, 200);
const samples = [
  [320, 200],
  [80, 24],
  [1200, 40],
];
const rows = samples
  .map(
    ([width, height]) =>
      `<section><h2>${width} × ${height}</h2><p>Before: fixed 320 × 200 geometry after resizing</p><div class="host" style="overflow:hidden;width:${width}px;height:${height}px"><span class="old-material" style="clip-path:${fixed.clipPath.replaceAll('"', '&quot;')}"></span>${fixed.borderSvg}</div><p>After: CSS geometry at the element's current size</p><div class="host" data-frame="panel" style="width:${width}px;height:${height}px">${layers}</div></section>`
  )
  .join('\n');
await writeFile(
  new URL('index.html', output),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Responsive frames without runtime JavaScript</title><link rel="stylesheet" href="frames.css"><style>
body{background:repeating-linear-gradient(45deg,#112738 0 12px,#193347 12px 24px);color:white;font:14px system-ui;margin:24px}
h1{font-size:24px}h2{font-size:18px}section{margin-block:24px}.host{position:relative;isolation:isolate;--frame-material:#345266;color:#71e3ff}.old-material{position:absolute;inset:0;background:#345266}.host>svg{position:absolute;inset:0}main{overflow:auto}
</style></head><body><header><h1>Responsive frames without runtime JavaScript</h1><p>The stripes remain visible through every cut. Both rows use the same LiNo schema.</p></header><main>${rows}</main></body></html>`
);
console.log('Built examples/themes/responsive-frames/dist/index.html');
