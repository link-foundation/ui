/* global URL */
/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

import { FLUENT_FILES } from './fluent2/names.js';
export { fluentThemeFromBrand, fluentBrandRamp } from './fluent2/brand.js';
export { loadMapping, mappingMarkdown } from './mapping.js';

export function listThemes() {
  return ['base', 'fluent2'];
}

/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  const files = id === 'fluent2' ? FLUENT_FILES : ['theme'];
  const sources = [];
  for (const file of files) {
    const url = new URL(`../themes/${id}/${file}.lino`, import.meta.url);
    const text =
      url.protocol === 'file:'
        ? await (await import('node:fs/promises')).readFile(url, 'utf8')
        : await (await fetch(url)).text();
    sources.push(text);
  }
  const { themes, diagnostics } = loadThemes(sources.join('\n'));
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return resolveTheme(new Map(themes.map((theme) => [theme.id, theme])), id);
}
