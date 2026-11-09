/**
 * `toCss(resolved, options)`: CSS custom properties. Aliases stay
 * `var(--color-primary)` so that a runtime change of the target cascades;
 * a typography token becomes one property per field
 * (`--type-body-font-size`), because CSS has no typography value.
 */

import { values as coreValues } from '@link-foundation/ui-core';
import { rgba } from './native.js';
import { cssVariable } from '../names.js';
import { COMPOSITE_FIELDS, FONT_WEIGHTS } from '../values.js';

const { colorCss } = coreValues;

/**
 * @typedef {import('../types.js').ResolvedTokens} ResolvedTokens
 * @typedef {import('../types.js').ResolvedToken} ResolvedToken
 * @typedef {import('../types.js').TokenValue} TokenValue
 */

/** Generic families are keywords; other names are quoted strings. */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);

const fontName = (name) =>
  GENERIC_FAMILIES.has(name) ? name : `"${name.replace(/["\\]/gu, '\\$&')}"`;

/** A colour as CSS; hex is lower-case (`#6750a4`). */
const color = (value) => {
  const css = colorCss(value);
  return css.startsWith('#') ? css.toLowerCase() : css;
};

/**
 * One value as CSS text.
 * @param {TokenValue} value  as written, aliases kept
 * @param {(path: string) => string} ref  CSS of an alias
 */
function valueCss(value, ref) {
  switch (value.type) {
    case 'token-ref':
      return ref(value.path);
    case 'color':
      return color(value);
    case 'dimension':
    case 'duration':
      return `${value.value}${value.unit}`;
    case 'number':
      return String(value.value);
    case 'fontFamily':
      return [value.value]
        .flat()
        .flatMap((name) => name.split(',').map((part) => part.trim()))
        .map(fontName)
        .join(', ');
    case 'fontWeight':
      return String(FONT_WEIGHTS[value.value] ?? value.value);
    case 'cubicBezier':
      return `cubic-bezier(${value.value.join(', ')})`;
    case 'shadow':
      return [value.value]
        .flat()
        .map((layer) => shadowCss(layer, ref))
        .join(', ');
    default:
      throw new TypeError(`No CSS value for the type ${value.type}`);
  }
}

function shadowCss(layer, ref) {
  if (layer.type === 'token-ref') {
    return ref(layer.path);
  }
  const { color: c, offsetX, offsetY, blur, spread, inset } = layer;
  const parts = [offsetX, offsetY, blur, spread, c].map((v) =>
    valueCss(v, ref)
  );
  return `${inset ? 'inset ' : ''}${parts.join(' ')}`;
}

const kebab = (key) => key.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);

/**
 * The declarations of one token: `[name, value, description?]`.
 * @param {ResolvedToken} token
 */
function declarations(token, prefix, channels) {
  const ref = (path) => `var(${cssVariable(path, prefix)})`;
  const name = cssVariable(token.path, prefix);
  if (token.type !== 'typography') {
    const output = [[name, valueCss(token.raw, ref)]];
    if (channels && token.type === 'color') {
      const c = rgba(token.value);
      output.push([
        `${name}-rgb`,
        token.raw.type === 'token-ref'
          ? `var(${cssVariable(token.raw.path, prefix)}-rgb)`
          : [c.r, c.g, c.b].map((n) => Number((n * 255).toFixed(6))).join(' '),
      ]);
    }
    return output;
  }
  return COMPOSITE_FIELDS.typography.map(([field, key]) => [
    `${name}-${field}`,
    token.raw.type === 'token-ref'
      ? `var(${cssVariable(token.raw.path, prefix)}-${kebab(key)})`
      : valueCss(token.raw.value[key], ref),
  ]);
}

const comment = (text) => `/* ${text.replace(/\*\//gu, '* /')} */`;

function block(selector, tokens, prefix, pad, channels) {
  const lines = [`${pad}${selector} {`];
  for (const token of tokens.values()) {
    if (token.description !== undefined) {
      lines.push(`${pad}  ${comment(token.description)}`);
    }
    for (const [name, value] of declarations(token, prefix, channels)) {
      lines.push(`${pad}  ${name}: ${value};`);
    }
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

/**
 * The tokens as CSS custom properties: one rule for the resolved tokens and
 * one per mode with the tokens the mode changes.
 * @param {ResolvedTokens} resolved
 * @param {{
 *   selector?: string,
 *   prefix?: string,
 *   modeSelector?: (mode: string) => string,
 *   modeMedia?: Record<string, string>,
 * }} [options]
 *   `selector` (default `:root`) holds the tokens; `prefix` starts every
 *   name (`md` gives `--md-color-primary`); a mode's rule uses
 *   `modeSelector(mode)` (default `[data-mode="dark"]`) unless
 *   `modeMedia[mode]` gives a media query, then it is
 *   `@media QUERY { SELECTOR { ... } }`
 * @returns {string}
 */
export function toCss(
  resolved,
  {
    selector = ':root',
    prefix = '',
    modeSelector = (mode) => `[data-mode="${mode}"]`,
    modeMedia = {},
    channels = false,
    pack = false,
    paletteSelector = (id) => `[data-palette=${JSON.stringify(id)}]`,
  } = {}
) {
  if (pack) {
    return [...resolved]
      .map(([id, tokens]) => {
        const scope = paletteSelector(id);
        return toCss(tokens, {
          selector: scope,
          prefix,
          channels,
          modeMedia,
          modeSelector: (mode) => `${scope}:is(${modeSelector(mode)})`,
        });
      })
      .join('\n');
  }
  const rules = [block(selector, resolved, prefix, '', channels)];
  for (const [mode, tokens] of resolved.modes ?? []) {
    if (tokens.size === 0) {
      continue;
    }
    rules.push(
      Object.hasOwn(modeMedia, mode)
        ? `@media ${modeMedia[mode]} {\n${block(selector, tokens, prefix, '  ', channels)}\n}`
        : block(modeSelector(mode), tokens, prefix, '', channels)
    );
  }
  return `${rules.join('\n\n')}\n`;
}
