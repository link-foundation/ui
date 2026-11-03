import { writeFile } from 'node:fs/promises';
import { formatLinks } from '@link-foundation/ui-core';

// Numeric key/ambient layers verified against Material Web's elevation implementation.
// https://github.com/material-components/material-web/blob/main/elevation/internal/_elevation.scss
const key = [
  [0, 0],
  [1, 2],
  [1, 2],
  [1, 3],
  [2, 3],
  [4, 4],
];
const ambient = [
  [0, 0, 0],
  [1, 3, 1],
  [2, 6, 2],
  [4, 8, 3],
  [6, 10, 4],
  [8, 12, 6],
];
const layer = ([y, blur, spread = 0], alpha) => [
  'shadow',
  ['color', `#000000${alpha}`],
  ['offset-x', '0px'],
  ['offset-y', `${y}px`],
  ['blur', `${blur}px`],
  ['spread', `${spread}px`],
];
const tokens = key.flatMap((item, i) => [
  [
    'token',
    `elevation.level${i}`,
    layer(item, '4d'),
    layer(ambient[i], '26'),
    ['m3', `md.sys.elevation.level${i}`],
  ],
  ['token', `elevation.${i}`, ['token', `elevation.level${i}`]],
  [
    'token',
    `elevation.level${i}.height`,
    `${[0, 1, 3, 6, 8, 12][i]}px`,
    ['m3', `md.sys.elevation.level${i}`],
  ],
]);
await writeFile(
  'packages/ui-themes/themes/material3/elevation.lino',
  formatLinks([
    {
      id: 'material3-elevation',
      values: [
        'theme',
        ['source', 'https://m3.material.io/styles/elevation/tokens'],
        ...tokens,
      ],
    },
  ])
);
