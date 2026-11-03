/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

import { readThemeFile } from './material3/mapping.js';
export { getMuiMapping } from './material3/mapping.js';
export { materialThemeFromSeed } from './material3/seed.js';
export { muiThemeToLino } from './material3/mui.js';

export function listThemes() {
  return ['base', 'material3'];
}

/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  const paths =
    id === 'material3'
      ? [
          'base/theme.lino',
          ...[
            'colors',
            'type',
            'shape',
            'elevation',
            'motion',
            'styles',
            'templates',
            'theme',
          ].map((name) => `material3/${name}.lino`),
        ]
      : ['base/theme.lino'];
  const text = (await Promise.all(paths.map(readThemeFile))).join('\n');
  const { themes, diagnostics } = loadThemes(text);
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return resolveTheme(new Map(themes.map((theme) => [theme.id, theme])), id);
}
