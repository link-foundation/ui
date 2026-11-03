/**
 * The colours of a link view, as ui-tokens design tokens written in Links
 * Notation (`color.link.*`), with a `dark` mode. The renderers take every
 * colour from here (or from the `--color-link-*` CSS custom properties that
 * override these tokens on a page), never from their own code.
 *
 * The blueprint colours follow links-visuals: the start point green, the end
 * red, the centre black (the line colour in dark mode) and the other points
 * blue, all at least 3:1 against the background (WCAG 2.2, 1.4.11).
 */

import { values } from '@link-foundation/ui-core';
import {
  cssVariable,
  readTokens,
  resolveTokens,
} from '@link-foundation/ui-tokens';

/** The token set of a link view (`link-view` theme), light and dark. */
export const LINK_TOKENS = `(link-view: theme
  (token color.link.background '#E0F7FA' (description 'Behind the link and the grid.'))
  (token color.link.line '#263238' (description 'The line of a link.'))
  (token color.link.source (token color.link.line) (description 'The marker at the source end.'))
  (token color.link.target (token color.link.line) (description 'The marker at the target end.'))
  (token color.link.grid.minor '#FFFFFF80' (description 'The grid lines every half step.'))
  (token color.link.grid.major '#FFFFFFCC' (description 'The grid lines every step.'))
  (token color.link.blueprint.start '#2E7D32' (description 'The first blueprint point.'))
  (token color.link.blueprint.end '#C62828' (description 'The last blueprint point.'))
  (token color.link.blueprint.center '#000000' (description 'The blueprint point at the centre.'))
  (token color.link.blueprint.point '#1565C0' (description 'The other blueprint points.'))
  (token color.link.blueprint.guide '#1565C0' (description 'The dashed guide through the points.'))
  (token color.link.focus '#1565C0' (description 'The focus ring of a link view.'))
  (mode dark
    (token color.link.background '#0B1F24')
    (token color.link.line '#ECEFF1')
    (token color.link.grid.minor '#FFFFFF1F')
    (token color.link.grid.major '#FFFFFF47')
    (token color.link.blueprint.start '#81C784')
    (token color.link.blueprint.end '#EF9A9A')
    (token color.link.blueprint.center (token color.link.line))
    (token color.link.blueprint.point '#64B5F6')
    (token color.link.blueprint.guide '#64B5F6')
    (token color.link.focus '#90CAF9')))`;

/** The token path of each colour role the renderers use. */
export const COLOR_TOKENS = Object.freeze({
  background: 'color.link.background',
  line: 'color.link.line',
  source: 'color.link.source',
  target: 'color.link.target',
  gridMinor: 'color.link.grid.minor',
  gridMajor: 'color.link.grid.major',
  blueprintStart: 'color.link.blueprint.start',
  blueprintEnd: 'color.link.blueprint.end',
  blueprintCenter: 'color.link.blueprint.center',
  blueprintPoint: 'color.link.blueprint.point',
  blueprintGuide: 'color.link.blueprint.guide',
  focus: 'color.link.focus',
});

/**
 * @typedef {Readonly<Record<keyof typeof COLOR_TOKENS, string>>} LinkColors
 */

/**
 * The colours of a link view in a mode, as CSS colour text.
 * @param {{mode?: 'light'|'dark'|null, tokens?: string}} [options]  `tokens`
 *   replaces the built-in token set (it must define the `link-view` theme)
 * @returns {LinkColors}
 */
export function linkColors({ mode = null, tokens = LINK_TOKENS } = {}) {
  const { sets } = readTokens(tokens);
  const resolved = resolveTokens(sets, 'link-view', {
    mode: mode === 'light' ? null : mode,
  });
  const colors = {};
  for (const [role, path] of Object.entries(COLOR_TOKENS)) {
    const token = resolved.get(path);
    if (token === undefined || token.type !== 'color') {
      throw new Error(`linkColors: the token ${path} is not a colour`);
    }
    colors[role] = values.colorCss(token.value);
  }
  return Object.freeze(colors);
}

/**
 * The CSS custom property of each colour role (`--color-link-line`), the
 * names ui-tokens `toCss` writes for the tokens.
 * @param {string} [prefix]
 * @returns {Readonly<Record<string, string>>}
 */
export function colorVariables(prefix = '') {
  const names = {};
  for (const [role, path] of Object.entries(COLOR_TOKENS)) {
    names[role] = cssVariable(path, prefix);
  }
  return Object.freeze(names);
}
