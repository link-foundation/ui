import {
  createDoubletProvider,
  doubletGeometry,
  DOUBLET_MARKERS,
} from '../src/links-view/doublet.js';
import { createNetworkPresentation } from '../src/links-view/presentation.js';

async function figure(parent, label, items, options) {
  const p = createNetworkPresentation(createDoubletProvider());
  await p.update({ items, options, index: '42' });
  const node = document.createElement('figure'),
    caption = document.createElement('figcaption');
  caption.textContent = label;
  node.append(caption);
  node.insertAdjacentHTML('beforeend', p.toSvg());
  document.getElementById(parent).append(node);
  return p;
}
const scenes = [
  [
    '11 22 12',
    [
      [1, 1],
      [2, 2],
      [1, 2],
    ],
    'caption\n  mode pairs',
  ],
  [
    '11 · symmetric figure-eight',
    [[1, 1]],
    'background\n  type linear\ncard\n  opacity 0.5\n  border double\n  radius 12\n  inset 3',
  ],
  ['00 · neutral free ends', [[0, 0]], 'caption\n  mode links'],
  [
    '22 11 · mirror lens',
    [
      [2, 2],
      [1, 1],
    ],
    'angles mirror\ncaption\n  mode theory',
  ],
  [
    'Turns and four gaps',
    [
      [2, 2],
      [1, 1],
    ],
    'link 1\n  turns 30 -30\n  gaps 0.2 ~ 5 5\nbackground\n  type radial\ncard\n  border dashed\n  radius 8\n  inset 2',
  ],
  [
    'Dice placement',
    Array.from({ length: 9 }, (_, i) => [i + 1, ((i + 1) % 9) + 1]),
    "layout dice\ncaption\n  mode custom\n  text 'Nine links, two dice tiles'",
  ],
];
const views = [];
for (const [label, items, options] of scenes) {
  views.push(
    await figure('overview', label, items, `width 256\nheight 200\n${options}`)
  );
}
for (const size of [0.5, 15]) {
  for (const shape of DOUBLET_MARKERS) {
    await figure(
      'markers',
      `${shape} · ${size}`,
      [[0, 0]],
      `width 128\nheight 96\nstrokeWidth 0.5\nstart\n  shape none\nmiddle\n  shape none\nend\n  shape ${shape}\n  size ${size}\n  offset 0`
    );
  }
}
window.doubletGallery = {
  views,
  createDoubletProvider,
  createNetworkPresentation,
  doubletGeometry,
  ready: true,
};
