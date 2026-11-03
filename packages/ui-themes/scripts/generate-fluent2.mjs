/** Fluent token data, Microsoft Corporation, MIT. See assets/fluent2/LICENSE.txt.
 * Sources: https://github.com/microsoft/fluentui/tree/master/packages/tokens
 * https://fluent2.microsoft.design/color */
import { mkdir, writeFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  webLightTheme,
  webDarkTheme,
  teamsHighContrastTheme,
  createLightTheme,
  createDarkTheme,
} from '@fluentui/tokens';
import { formatLinks } from '@link-foundation/ui-core';
import { fluentTokenPath } from '../src/fluent2/names.js';

const category = (name) => {
  if (name.startsWith('color')) {
    return 'colors';
  }
  if (name.startsWith('border') || name.startsWith('stroke')) {
    return 'shape';
  }
  if (name.startsWith('spacing')) {
    return 'spacing';
  }
  if (name.startsWith('shadow')) {
    return 'shadow';
  }
  if (name.startsWith('duration') || name.startsWith('curve')) {
    return 'motion';
  }
  return 'type';
};
/** Translate CSS exchange values into typed LiNo; never parse LiNo here. */
export function fluentValue(name, value) {
  if (name.startsWith('curve')) {
    return ['cubic-bezier', ...value.slice(13, -1).split(',')];
  }
  if (name.startsWith('shadow')) {
    // Each Fluent shadow layer is: x y blur rgba(...). Split only at commas
    // outside parentheses, so the rgba channels stay together.
    const parts = value.split(/,\s*(?![^()]*\))/u);
    return parts.map((part) => {
      const [x, y, blur, ...color] = part.split(' ');
      return [
        'shadow',
        ['offset-x', x],
        ['offset-y', y],
        ['blur', blur],
        ['spread', '0px'],
        [
          'color',
          color
            .join(' ')
            .replace('rgba(', 'rgb ')
            .replace(')', '')
            .split(/[, ]+/u),
        ],
      ];
    });
  }
  if (typeof value === 'string' && value.startsWith('rgba(')) {
    return [
      'rgb',
      ...value
        .slice(5, -1)
        .split(',')
        .map((v) => v.trim()),
    ];
  }
  if (value === 'transparent') {
    return '#00000000';
  }
  return String(value);
}
const token = (name, value) => [
  'token',
  fluentTokenPath(name),
  fluentValue(name, value),
  ['fluent', name],
  ['source-value', String(value)],
];

/** Output can be redirected for deterministic regeneration checks. */
export async function generateFluent2(directory, aliasFile) {
  await mkdir(directory, { recursive: true });
  const output = new Map();
  for (const [mode, source] of [
    ['light', webLightTheme],
    ['dark', webDarkTheme],
    ['high-contrast', teamsHighContrastTheme],
  ]) {
    for (const group of [
      'colors',
      'shape',
      'spacing',
      'type',
      'shadow',
      'motion',
    ]) {
      const name = group + (mode === 'light' ? '' : `-${mode}`);
      const tokens = Object.entries(source)
        .filter(([key]) => category(key) === group)
        .map(([key, value]) => token(key, value));
      const body = mode === 'light' ? tokens : [['mode', mode, ...tokens]];
      if (group === 'colors' && mode === 'light') {
        body.push(
          ...Object.keys(source)
            .filter((key) => key.startsWith('color'))
            .map((key) => {
              const system = key.includes('ForegroundOnBrand')
                ? 'HighlightText'
                : key.includes('Foreground')
                  ? 'CanvasText'
                  : key.includes('Stroke')
                    ? 'CanvasText'
                    : key.includes('BrandBackground')
                      ? 'Highlight'
                      : 'Canvas';
              return ['forced-color', fluentTokenPath(key), system];
            })
        );
      }
      if (group === 'motion' && mode === 'light') {
        body.push([
          'motion',
          'reduced',
          ...Object.keys(source)
            .filter((key) => key.startsWith('duration'))
            .map((key) => ['token', fluentTokenPath(key), '0ms']),
        ]);
      }
      output.set(
        `${name}.lino`,
        formatLinks([{ id: `fluent2-${name}`, values: ['theme', ...body] }])
      );
    }
  }
  // Two sentinel ramps distinguish brand-dependent aliases from fixed colours.
  const ramp = Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [
      (i + 1) * 10,
      `#${((i + 1) * 0x0a0a0a).toString(16).padStart(6, '0')}`,
    ])
  );
  const secondRamp = Object.fromEntries(
    Object.entries(ramp).map(([stop]) => [stop, '#f12345'])
  );
  const mapping = [];
  for (const [mode, factory] of [
    ['light', createLightTheme],
    ['dark', createDarkTheme],
  ]) {
    mapping.push([
      'mode',
      mode,
      ...Object.entries(factory(ramp))
        .filter(
          ([key, value]) =>
            Object.values(ramp).includes(value) &&
            factory(secondRamp)[key] !== value
        )
        .map(([key, value]) => [
          'alias',
          key,
          String(Object.entries(ramp).find(([, v]) => v === value)[0]),
        ]),
    ]);
  }
  output.set(
    'brand-aliases.lino',
    formatLinks([{ id: 'fluent2-brand', values: ['brand', ...mapping] }])
  );
  const aliasObject = Object.fromEntries(
    mapping.map(([, mode, ...rows]) => [
      mode,
      Object.fromEntries(rows.map(([, name, stop]) => [name, Number(stop)])),
    ])
  );
  aliasObject['high-contrast'] = Object.fromEntries(
    [
      ...new Set(
        Object.values(aliasObject).flatMap((mode) => Object.keys(mode))
      ),
    ].map((key) => [key, teamsHighContrastTheme[key]])
  );
  if (aliasFile) {
    await writeFile(
      aliasFile,
      `// Generated by generate-fluent2.mjs from @fluentui/tokens.\n// prettier-ignore\nexport const BRAND_ALIASES = ${JSON.stringify(aliasObject, null, 2)};\n`
    );
  }
  for (const [name, text] of output) {
    await writeFile(new URL(name, directory), text);
  }
  return output;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateFluent2(
    new URL('../themes/fluent2/', import.meta.url),
    new URL('../src/fluent2/brand-aliases.js', import.meta.url)
  );
}
