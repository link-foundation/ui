/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

import { readThemeFile } from './mapping.js';
import { FLUENT_FILES } from './fluent2/names.js';
export { fluentThemeFromBrand, fluentBrandRamp } from './fluent2/brand.js';
export { loadMapping, mappingMarkdown } from './mapping.js';
export { readMapping } from './mapping.js';
export { getMuiMapping } from './material3/mapping.js';
export { materialThemeFromSeed } from './material3/seed.js';
export { muiThemeToLino } from './material3/mui.js';

const fragments = [
  'colors',
  'type',
  'shape',
  'spacing',
  'motion',
  'materials',
  'styles',
  'templates',
];
export function listThemes() {
  return ['base', 'material3', 'fluent2', 'hig', 'hig-ios', 'hig-macos'];
}

/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  const files =
    id === 'material3'
      ? [
          'base/theme',
          ...[
            'colors',
            'type',
            'shape',
            'elevation',
            'motion',
            'styles',
            'templates',
            'theme',
          ].map((name) => `material3/${name}`),
        ]
      : id === 'fluent2'
        ? FLUENT_FILES.map((name) => `fluent2/${name}`)
        : id === 'base'
          ? ['base/theme']
          : [
              ...fragments.map((name) => `hig/${name}`),
              'hig/theme',
              ...(id === 'hig' ? [] : [`${id}/theme`]),
            ];
  const sources = [];
  for (const file of files) {
    sources.push(await readThemeFile(`${file}.lino`));
  }
  const { themes, diagnostics } = loadThemes(sources.join('\n'));
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return resolveTheme(new Map(themes.map((theme) => [theme.id, theme])), id);
}

/** SwiftUI view/modifier rows in the shared mapping format. */
export async function getSwiftuiMapping() {
  const { readMapping } = await import('./mapping.js');
  return readMapping(await readThemeFile('hig/swiftui-mapping.lino'));
}
