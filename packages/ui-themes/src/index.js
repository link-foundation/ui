/* global URL */
/** Shipped themes remain LiNo data, loaded in browsers or Node without a build. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';

export function listThemes() {
  return ['base'];
}

/** @param {string} id @returns {Promise<import('@link-foundation/ui-tokens/themes').Theme>} */
export async function loadTheme(id) {
  if (!listThemes().includes(id)) {
    throw new RangeError(`Unknown theme: ${id}`);
  }
  const url = new URL(`../themes/${id}/theme.lino`, import.meta.url);
  const text =
    url.protocol === 'file:'
      ? await (await import('node:fs/promises')).readFile(url, 'utf8')
      : await (await fetch(url)).text();
  const { themes, diagnostics } = loadThemes(text);
  if (diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(diagnostics.map((d) => d.message).join('; '));
  }
  return resolveTheme(new Map(themes.map((theme) => [theme.id, theme])), id);
}
