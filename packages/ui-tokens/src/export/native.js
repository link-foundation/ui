/**
 * What the Swift and Kotlin writers share: the constants come in sections
 * (the resolved tokens, then one nested namespace per mode with the tokens
 * the mode changes), a whole-token alias refers to the constant of its
 * target, and values are converted to the units of the platforms (1rem is
 * 16 points, durations are numbers).
 */

import { values as coreValues } from '@link-foundation/ui-core';
import { FONT_WEIGHTS } from '../values.js';
import { upperCamel } from '../names.js';

const { oklchToSrgb } = coreValues;

/**
 * @typedef {import('../types.js').ResolvedTokens} ResolvedTokens
 * @typedef {import('../types.js').ResolvedToken} ResolvedToken
 * @typedef {import('../types.js').TokenValue} TokenValue
 *
 * @typedef {object} Section
 * @property {string|null} mode
 * @property {string[]} scope  the qualified name: `['Tokens', 'Dark']`
 * @property {Map<string, ResolvedToken>} tokens
 */

/** The points of one rem (the CSS default root font size). */
export const REM = 16;

/** A number without float noise: `0.15`, not `0.15000000000000002`. */
export const num = (x) => String(Number(x.toPrecision(12)));

/** A dimension in points (px and pt are the same at 1x). */
export const points = (d) => (d.unit === 'rem' ? d.value * REM : d.value);

/** A duration in milliseconds. */
export const millis = (d) => (d.unit === 's' ? d.value * 1000 : d.value);

/** A font weight as a number 1..1000. */
export const weight = (w) =>
  typeof w.value === 'number' ? w.value : FONT_WEIGHTS[w.value];

/** sRGB channels 0..1 (oklch converted, out-of-gamut clamped). */
export function rgba(color) {
  const c = color.space === 'oklch' ? oklchToSrgb(color) : color;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  return { r: clamp(c.r), g: clamp(c.g), b: clamp(c.b), a: clamp(c.a) };
}

/** The layers of a resolved shadow. */
export const layers = (shadow) => [shadow.value].flat();

/**
 * The resolved tokens and, per mode, the tokens the mode changes.
 * @param {ResolvedTokens} resolved
 * @param {string} name  the name of the outer namespace
 * @returns {Section[]}
 */
export function sections(resolved, name) {
  return [
    { mode: null, scope: [name], tokens: resolved },
    ...[...(resolved.modes ?? [])]
      .filter(([, tokens]) => tokens.size > 0)
      .map(([mode, tokens]) => ({
        mode,
        scope: [name, upperCamel(mode)],
        tokens,
      })),
  ];
}

/**
 * The qualified constant an alias token refers to: the mode's own constant
 * when the mode changes the target, otherwise the outer one.
 * @param {ResolvedToken} token  a token with `alias`
 * @param {Section} section
 * @param {(token: ResolvedToken) => string} constant  the constant name
 * @param {ResolvedTokens} resolved
 */
export function aliasReference(token, section, constant, resolved) {
  const local = section.tokens.get(token.alias);
  const target = local ?? resolved.get(token.alias);
  const scope = local === undefined ? section.scope.slice(0, 1) : section.scope;
  return [...scope, constant(target)].join('.');
}

/**
 * Throw when two tokens of a section get the same constant name
 * (`color.on-primary` and `color.onPrimary`).
 * @param {Section[]} all
 * @param {(token: ResolvedToken) => string} constant
 */
export function checkNames(all, constant) {
  for (const { tokens } of all) {
    const seen = new Map();
    for (const token of tokens.values()) {
      const name = constant(token);
      if (seen.has(name)) {
        throw new TypeError(
          `The tokens "${seen.get(name)}" and "${token.path}" are both ${name}`
        );
      }
      seen.set(name, token.path);
    }
  }
}

/** Every type the sections use, with the fields of composites. */
export function usedTypes(all) {
  const types = new Set();
  for (const { tokens } of all) {
    for (const token of tokens.values()) {
      types.add(token.type);
    }
  }
  if (types.has('shadow')) {
    types.add('color').add('dimension');
  }
  if (types.has('typography')) {
    types.add('fontFamily').add('dimension').add('fontWeight');
  }
  return types;
}

/** The lines of a description, for doc comments. */
export const descriptionLines = (text) => text.split(/\r?\n/u);
