// Reproducible data draft. Run from the repository root after obtaining the
// pinned immortality styles.css described in README.md; no source app executes.
import process from 'node:process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { formatLinks as formatRaw } from '@link-foundation/ui-core';

const strings = (v) =>
  Array.isArray(v) ? v.map(strings) : typeof v === 'number' ? String(v) : v;
const formatLinks = (links) =>
  formatRaw(links.map((l) => ({ ...l, values: strings(l.values) })));
const root = 'packages/ui-themes/themes/classic';
const entries = [];
const token = (path, value) => ['token', path, value];
const tokens = (map) => Object.entries(map).map(([k, v]) => token(k, v));
const style = (kind, map) => [
  'style',
  ['selector', ['type', kind]],
  ...Object.entries(map).map(([k, v]) => [k, v]),
];
const semantic = (bg, fg, accent, on = '#FFFFFF') => ({
  'chat.text': fg,
  'chat.sidebar': bg,
  'chat.bubble.in': bg,
  'chat.bubble.in.text': fg,
  'chat.bubble.out': accent,
  'chat.bubble.out.text': on,
  'chat.edge': fg,
  'color.primary': accent,
  'color.on-primary': on,
  'color.surface': bg,
  'color.on-surface': fg,
  'color.on-surface-variant': ['token', 'color.on-surface'],
  'color.outline': fg,
  'motion.duration.short': '150ms',
});
const contrast = [
  'mode',
  'high-contrast',
  ...tokens(semantic('#FFFFFF', '#000000', '#000000')),
];
const reduced = [
  'motion',
  'reduced',
  token('motion.duration.short', '0ms'),
  ...tokens({ 'effect.glow': 0, 'effect.scanline': 0, 'effect.flicker': 0 }),
];
async function pack(family, file, id, light, dark = light, options = []) {
  const { extras, parent = 'base' } = Array.isArray(options)
    ? { extras: options }
    : options;
  await mkdir(`${root}/${family}`, { recursive: true });
  const values = [
    'theme',
    ...(parent ? [['extends', parent]] : []),
    ...tokens(light),
    ['mode', 'dark', ...tokens(dark)],
    contrast,
    reduced,
    ...extras,
  ];
  await writeFile(
    `${root}/${family}/${file}.lino`,
    formatLinks([{ id, values }])
  );
  entries.push({ id, path: `classic/${family}/${file}.lino`, family });
}
const light = semantic('#EDF2F7', '#3A3A3A', '#0080FF', '#000000');
const dark = semantic('#141214', '#EBF8FF', '#0080FF', '#000000');
const graph = {
  'color.background': ['token', 'color.surface'],
  'color.surface-modal': '#19202B',
  'graph.edge': '#727278',
  'graph.node': '#0080FF',
  'graph.label': ['token', 'color.on-surface'],
};
const rules = [
  style('graph-canvas', { background: ['token', 'color.background'] }),
  style('link-edge', { stroke: ['token', 'graph.edge'], arrow: 'triangle' }),
  style('link-node', {
    background: ['token', 'graph.node'],
    color: ['token', 'graph.label'],
  }),
];
await pack(
  'deepcase',
  'classic',
  'deepcase-classic',
  { ...light, ...graph, 'color.surface-modal': '#EBF8FF' },
  { ...dark, ...graph },
  rules
);
await pack(
  'deepcase',
  'dark',
  'deepcase-dark',
  { ...dark, ...graph },
  { ...dark, ...graph },
  [['menu', 'radial'], ...rules]
);
const perception = {
  ...semantic('#19202B', '#EBF8FF', '#00FFFF', '#000000'),
  ...graph,
  'graph.node': '#4299E1',
  'color.background': '#19202B',
  'color.surface-modal': '#1B2535',
  'color.active': '#00FFFF',
  'color.splash': '#0D1117',
};
await pack(
  'deepcase',
  'perception',
  'deepcase-perception',
  perception,
  perception,
  rules
);
const modern = {
  ...semantic('#000000', '#FFFFFF', '#CCCCCC', '#000000'),
  ...graph,
  'color.background': '#000000',
  'graph.value.value': '#64B5F6',
  'graph.value.symbol': '#FFD54F',
  'graph.value.undefined': '#90A4AE',
  'graph.value.promise': '#4DB6AC',
  'graph.value.boolean': '#F06292',
  'graph.value.string': '#81C784',
  'graph.value.number': '#7986CB',
  'graph.value.bigint': '#9575CD',
  'graph.value.set': '#4DD0E1',
};
await pack('deepcase', '2025', 'deepcase-2025', modern, modern, [
  ...rules,
  ...[
    'value',
    'symbol',
    'undefined',
    'promise',
    'boolean',
    'string',
    'number',
    'bigint',
    'set',
  ].map((k) => [
    'style',
    ['selector', ['type', 'link-node'], ['value-type', k]],
    ['background', ['token', `graph.value.${k}`]],
  ]),
]);
await pack(
  'deepcase',
  'landing',
  'deepcase-landing',
  {
    ...light,
    'surface.radius': '16px',
    'surface.opacity': 0.92,
    'surface.perspective': '450px',
  },
  {
    ...dark,
    'surface.radius': '16px',
    'surface.opacity': 0.92,
    'surface.perspective': '450px',
  }
);
for (const [id, opacity, radius, blur] of [
  ['glass', 0.78, '12px', '16px'],
  ['liquid', 0.65, '24px', '24px'],
  ['futuristic', 0.9, '0px', '0px'],
]) {
  const extra = {
    'surface.opacity': opacity,
    'surface.radius': radius,
    'surface.blur': blur,
    'shape.corner.full': radius,
    'shape.corner.small': radius,
    'ui.control.corner': radius,
    'chat.style.radius': radius,
    'chat.bubble.tail': radius,
  };
  await pack(
    'konard',
    id,
    id,
    { ...semantic('#E9F2FA', '#142B43', '#174D82'), ...extra },
    { ...semantic('#0B1626', '#E9F2FA', '#B9DCFF', '#10243A'), ...extra },
    [
      style('panel', {
        radius: ['token', 'surface.radius'],
        'surface-opacity': ['token', 'surface.opacity'],
        blur: ['token', 'surface.blur'],
      }),
      style('button', { radius: ['token', 'surface.radius'] }),
      style('composer', { radius: ['token', 'surface.radius'] }),
    ]
  );
}
// CSS variable values are ported from the licensed source; the palette IDs
// are the PALETTES catalogue in settings.ts. This is CSS extraction, not LiNo parsing.
const css = await readFile(
  process.argv[2] ?? 'experiments/issue-51/immortality.css',
  'utf8'
);
const ids = [
  'mission',
  'glitchy',
  'amber',
  'monochrome',
  'tron',
  'ares',
  'clu',
  'athena',
  'aphrodite',
  'poseidon',
  'soulextract',
  'matrix',
];
const paletteLinks = [];
for (const id of ids) {
  const section =
    id === 'mission'
      ? css.slice(css.indexOf(':root {'), css.indexOf('\n}'))
      : css.split(`.app-shell[data-palette='${id}'] {`).at(-1).split('\n}')[0];
  const vars = Object.fromEntries(
    [...section.matchAll(/--([\w-]+):\s*(#[\da-fA-F]+|rgba\([^;]+\));/gu)].map(
      (m) => [m[1], m[2]]
    )
  );
  const map = {
    ...semantic(vars['surface-1'], vars['text-primary'], vars.neon, '#000000'),
    'color.background':
      vars.page ??
      (['tron', 'ares', 'clu', 'athena', 'aphrodite', 'poseidon'].includes(id)
        ? '#000103'
        : '#05080D'),
  };
  for (const [key, value] of Object.entries(vars)) {
    map[`palette.${key}`] = value;
  }
  const themeId = `immortality-${id}`;
  paletteLinks.push({
    id: themeId,
    values: [
      'theme',
      ['extends', 'base'],
      ...tokens(map),
      ['mode', 'dark', ...tokens(map)],
      contrast,
      reduced,
    ],
  });
  entries.push({
    id: themeId,
    path: 'classic/immortality/palettes.lino',
    family: 'immortality',
  });
}
await mkdir(`${root}/immortality`, { recursive: true });
await writeFile(`${root}/immortality/palettes.lino`, formatLinks(paletteLinks));
for (const [id, palette, opacity, glow, frame] of [
  ['poseidon', 'poseidon', 0.7, 0.5, 14],
  ['arwes', 'tron', 0.7, 0.4, 16],
  ['quiet', 'monochrome', 1, 0, 0],
]) {
  const map = {
    'surface.opacity': opacity,
    'surface.blur': id === 'quiet' ? '0px' : '12px',
    'surface.radius': '0px',
    'frame.size': `${frame}px`,
    'frame.width': id === 'quiet' ? '0px' : '1px',
    'effect.glow': glow,
    'effect.scanline': id === 'arwes' ? 0.06 : 0,
    'effect.flicker': 0,
  };
  await pack('immortality', id, id, map, map, {
    extras: [
      style('panel', {
        'clip-path':
          id === 'quiet'
            ? 'inset(0px)'
            : id === 'arwes'
              ? 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)'
              : 'polygon(0% 0%, 12% 0%, 12% 6%, 24% 6%, 24% 0%, 100% 0%, 100% 100%, 0% 100%)',
        'border-style': 'solid',
        'surface-opacity': ['token', 'surface.opacity'],
        blur: ['token', 'surface.blur'],
        glow: ['token', 'effect.glow'],
        scanline: ['token', 'effect.scanline'],
        'border-width': ['token', 'frame.width'],
        'border-color': ['token', 'color.primary'],
        radius: ['token', 'surface.radius'],
      }),
    ],
    parent: `immortality-${palette}`,
  });
}
for (const [id, bg, fg, accent, opacity, radius] of [
  ['fa-flat', '#FFFFFF', '#1E252B', '#1F7A5B', 1, '0px'],
  ['fa-glass', '#FBFCFD', '#1E252B', '#1F7A5B', 0.78, '12px'],
  ['fa-material', '#F3F6F7', '#1E252B', '#1F7A5B', 1, '12px'],
  ['fa-contrast', '#FFFFFF', '#000000', '#000000', 1, '0px'],
]) {
  const extra = {
    'surface.opacity': opacity,
    'surface.radius': radius,
    'surface.blur': id === 'fa-glass' ? '16px' : '0px',
  };
  await pack(
    'formal-ai',
    id,
    id,
    { ...semantic(bg, fg, accent), ...extra },
    { ...semantic('#1D201F', '#ECE7DF', '#1F7A5B'), ...extra },
    [
      style('panel', {
        radius: ['token', 'surface.radius'],
        'surface-opacity': ['token', 'surface.opacity'],
        blur: ['token', 'surface.blur'],
      }),
      style('button', { radius: ['token', 'surface.radius'] }),
      style('composer', { radius: ['token', 'surface.radius'] }),
    ]
  );
}
for (const [id, padding, radius, width] of [
  ['cards', '16px', '4px', 1],
  ['compact', '4px', '2px', 1],
  ['bubbles', '10px', '18px', 0.88],
]) {
  const map = {
    'chat.style.padding': padding,
    'chat.style.radius': radius,
    'chat.style.width': width,
    'bubble.radius': radius,
    'chat.bubble.radius': radius,
  };
  await pack('formal-ai', `chat-${id}`, `chat-${id}`, map, map, {
    parent: null,
    extras: [
      style('message-bubble', {
        padding: ['token', 'chat.style.padding'],
        radius: ['token', 'chat.style.radius'],
      }),
    ],
  });
}
const composers = [];
for (const [id, opacity, radius] of [
  ['flat', 1, '0px'],
  ['glass-soft', 0.78, '12px'],
  ['glass-clear', 0.6, '12px'],
  ['bubble', 1, '24px'],
]) {
  const themeId = `composer-${id}`;
  composers.push({
    id: themeId,
    values: [
      'theme',
      ...tokens({ 'composer.opacity': opacity, 'composer.radius': radius }),
      ['mode', 'dark', token('composer.opacity', opacity)],
      contrast,
      reduced,
      style('composer', {
        radius: ['token', 'composer.radius'],
        'surface-opacity': ['token', 'composer.opacity'],
      }),
    ],
  });
  entries.push({
    id: themeId,
    path: 'classic/formal-ai/composer.lino',
    family: 'formal-ai',
  });
}
await writeFile(`${root}/formal-ai/composer.lino`, formatLinks(composers));
const metaSemantic = (...args) =>
  Object.fromEntries(
    Object.entries(semantic(...args)).filter(
      ([key]) => !key.startsWith('chat.')
    )
  );
for (const id of ['t3', 'telegram', 'whatsapp', 'signal']) {
  const source = await readFile(
    `packages/ui-components/src/chat/skins/${id}.lino`,
    'utf8'
  );
  // Use the official parser/formatter, including existing colour and layout tokens.
  const { parseNested } = await import('@link-foundation/ui-core');
  const link = parseNested(source)[0];
  const raw = (l) => (l.values.length ? l.values.map(raw) : l.id);
  const original = link.values.slice(1).map(raw);
  const radius = {
    t3: '14px',
    telegram: '15px',
    whatsapp: '7.5px',
    signal: '18px',
  }[id];
  const accent = {
    t3: '#176B45',
    telegram: '#185F96',
    whatsapp: '#006653',
    signal: '#245AC8',
  }[id];
  await pack(
    'meta-sovereign',
    `chat-${id}`,
    `chat-${id}`,
    { ...metaSemantic('#FFFFFF', '#17212B', accent), 'bubble.radius': radius },
    { ...metaSemantic('#121820', '#F0F5FA', accent), 'bubble.radius': radius },
    [
      ...original,
      ['pair', 'chat.bubble.in.text', 'chat.bubble.in'],
      ['pair', 'chat.bubble.out.text', 'chat.bubble.out'],
    ]
  );
}
await writeFile(
  'packages/ui-themes/src/classic/catalog.js',
  `/** Theme IDs and their canonical LiNo sources. */\nexport const classicThemes = ${JSON.stringify(entries, null, 2)};\n`
);
