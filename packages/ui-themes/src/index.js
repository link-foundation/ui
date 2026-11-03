/* global URL */
/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { classicThemes } from './classic/catalog.js';
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

export function listThemes() {
  return ['base', ...classicThemes.map((t) => t.id)];
}

// Share source reads within one runtime, while resolving a fresh theme per caller.
let registryPromise;
async function registry() {
  const paths = [
    'base/theme.lino',
    ...new Set(classicThemes.map((t) => t.path)),
  ];
  const texts = await Promise.all(
    paths.map(async (path) => {
      const url = new URL(`../themes/${path}`, import.meta.url);
      if (url.protocol === 'file:') {
        return (await import('node:fs/promises')).readFile(url, 'utf8');
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Theme source ${path}: HTTP ${response.status}`);
      }
      return response.text();
    })
  );
  const { themes, diagnostics } = loadThemes(texts.join('\n'));
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return new Map(themes.map((t) => [t.id, t]));
}
/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  registryPromise ??= registry().catch((error) => {
    registryPromise = undefined;
    throw error;
  });
  return resolveTheme(await registryPromise, id);
}
