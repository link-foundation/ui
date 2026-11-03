/**
 * States and conditions: `(state hover)`, `(media (max-width 640px))`,
 * `(media (prefers-color-scheme dark))`, `(container (min-width 400px))`.
 * Each is read once and then either tested against an environment
 * (`resolveStyle`) or written as CSS (`compileCss`).
 */

import { values } from '@link-foundation/ui-core';
import { styleDiagnostic } from './diagnostics.js';
import { rawText } from './properties.js';

/**
 * @typedef {import('./types.js').Condition} Condition
 * @typedef {import('./types.js').StyleEnv} StyleEnv
 * @typedef {import('./types.js').RawValue} RawValue
 */

/** The states, in the order of the issue. */
export const STATES = Object.freeze([
  'hover',
  'focus',
  'pressed',
  'disabled',
  'selected',
  'checked',
]);

/** The CSS of every state (Selectors Level 4, ARIA attributes). */
export const STATE_CSS = Object.freeze({
  hover: ':hover',
  focus: ':focus-visible',
  pressed: ':active',
  disabled: `:is(:disabled, [disabled], [aria-disabled='true'])`,
  selected: `[aria-selected='true']`,
  checked: `[aria-checked='true']`,
});

const WIDTH = { type: 'dimension' };
const UNITS = new Set(['px', 'rem', 'em']);

/** The features of media and container conditions and their value types. */
export const FEATURES = Object.freeze({
  media: {
    'min-width': WIDTH,
    'max-width': WIDTH,
    'prefers-color-scheme': { type: ['enum', 'light', 'dark'] },
    'prefers-reduced-motion': { type: ['enum', 'reduce', 'no-preference'] },
  },
  container: { 'min-width': WIDTH, 'max-width': WIDTH },
});

/** Read one `(FEATURE VALUE)` condition, or `null` when invalid. */
function readCondition(kind, raw) {
  if (
    !Array.isArray(raw) ||
    raw.length !== 2 ||
    typeof raw[0] !== 'string' ||
    !Object.hasOwn(FEATURES[kind], raw[0])
  ) {
    return null;
  }
  const [feature, text] = raw;
  const { value } = values.typeValue(text, FEATURES[kind][feature]);
  const ok =
    value !== null &&
    (value.type === 'enum' ||
      (value.type === 'dimension' &&
        UNITS.has(value.unit) &&
        value.value >= 0));
  return ok ? { feature, value } : null;
}

/**
 * Whether a raw value is a condition: any leading link whose head is not a
 * declaration or a block (`(padding ...)`, `(state ...)`), so an unknown
 * feature such as `(min-height 10px)` is reported, not read as a property.
 */
const looksLikeCondition = (kind, raw, isBodyItem) =>
  Array.isArray(raw) &&
  typeof raw[0] === 'string' &&
  (Object.hasOwn(FEATURES[kind], raw[0]) || !isBodyItem(raw[0]));

/**
 * Split the values of a `media` or `container` block into its leading
 * conditions and its body.
 * @param {'media'|'container'} kind
 * @param {RawValue[]} raws
 * @param {Record<string, any>} at
 * @param {import('./types.js').Diagnostic[]} diagnostics
 * @param {(name: string) => boolean} isBodyItem  whether a head starts the body
 * @returns {{ conditions: Condition[]|null, body: RawValue[] }}
 */
export function readConditions(kind, raws, at, diagnostics, isBodyItem) {
  const conditions = [];
  let i = 0;
  for (; i < raws.length; i += 1) {
    if (!looksLikeCondition(kind, raws[i], isBodyItem)) {
      break;
    }
    const condition = readCondition(kind, raws[i]);
    if (condition === null) {
      diagnostics.push(
        styleDiagnostic('invalid-condition', 'error', {
          ...at,
          block: kind,
          text: rawText(raws[i]),
        })
      );
      return { conditions: null, body: [] };
    }
    conditions.push(condition);
  }
  if (conditions.length === 0) {
    diagnostics.push(
      styleDiagnostic('invalid-condition', 'error', {
        ...at,
        block: kind,
        text: raws.length === 0 ? '' : rawText(raws[0]),
      })
    );
    return { conditions: null, body: [] };
  }
  return { conditions, body: raws.slice(i) };
}

/** The root font size that `rem` and `em` widths are resolved with. */
export const ROOT_FONT_SIZE = 16;

/** A width in CSS pixels. */
const px = (dimension) =>
  dimension.unit === 'px' ? dimension.value : dimension.value * ROOT_FONT_SIZE;

/**
 * Whether a condition holds in an environment. A width condition never
 * holds when the width is unknown; the colour scheme defaults to `light`
 * and reduced motion to `false`, as in a browser without preferences.
 * @param {'media'|'container'} kind
 * @param {Condition} condition
 * @param {StyleEnv} env
 */
export function conditionHolds(kind, { feature, value }, env) {
  switch (feature) {
    case 'prefers-color-scheme':
      return (env.colorScheme ?? 'light') === value.value;
    case 'prefers-reduced-motion':
      return (env.reducedMotion === true) === (value.value === 'reduce');
    default: {
      const width = (kind === 'media' ? env.viewport : env.container)?.width;
      if (typeof width !== 'number') {
        return false;
      }
      return feature === 'min-width' ? width >= px(value) : width <= px(value);
    }
  }
}

/**
 * The CSS of the conditions of a block: `(max-width: 640px) and
 * (prefers-color-scheme: dark)`.
 * @param {Condition[]} conditions
 */
export const conditionsCss = (conditions) =>
  conditions
    .map(({ feature, value }) => `(${feature}: ${values.toCss(value)})`)
    .join(' and ');
