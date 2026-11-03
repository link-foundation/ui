/* global URL */
/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

export { readMapping } from './mapping.js';

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
  return ['base', 'hig', 'hig-ios', 'hig-macos'];
}

async function readThemeFile(path) {
  const url = new URL(`../themes/${path}.lino`, import.meta.url);
  if (url.protocol === 'file:') {
    return (await import('node:fs/promises')).readFile(url, 'utf8');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot load theme data: ${path} (${response.status})`);
  }
  return response.text();
}

/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  const files =
    id === 'base'
      ? ['base/theme']
      : [
          ...fragments.map((name) => `hig/${name}`),
          'hig/theme',
          ...(id === 'hig' ? [] : [`${id}/theme`]),
        ];
  const sources = [];
  for (const file of files) {
    sources.push(await readThemeFile(file));
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
  return readMapping(await readThemeFile('hig/swiftui-mapping'));
}
