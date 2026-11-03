/**
 * The style property vocabulary: every property a style rule may set, its
 * value type (the value types of ui-core, #15), the CSS property it maps to
 * and the token types it accepts through `(token PATH)`.
 *
 * Values are typed by ui-core `values.typeValue`, so only a well-formed
 * colour, dimension, number or enum (or a token reference) ever reaches the
 * CSS output: no free text, and never `url(`.
 */

import { values } from '@link-foundation/ui-core';
import { styleDiagnostic } from './diagnostics.js';

/**
 * @typedef {import('./types.js').TypedValue} TypedValue
 * @typedef {import('./types.js').RawValue} RawValue
 * @typedef {import('./types.js').Diagnostic} Diagnostic
 *
 * @typedef {object} PropertySpec
 * @property {string} css  the CSS property
 * @property {string|string[]} type  a ui-core value type
 * @property {number} [max]  how many values it takes (default 1)
 * @property {string[]} tokens  the token types `(token PATH)` may name;
 *   empty when the property takes no token
 * @property {(value: TypedValue) => boolean} [check]  a range check of a
 *   literal value
 * @property {(value: TypedValue, ctx: CssContext) => string} [write]  the
 *   CSS of a value, when it is not the ui-core `toCss` text
 * @property {string} [expected]  the expected value, for diagnostics
 *
 * @typedef {object} CssContext
 * @property {(ref: TypedValue, fallback?: string) => string} refToVar
 * @property {(path: string) => string} variable  a token path as `var(--...)`
 */

const nonNegative = (v) => v.type !== 'dimension' || v.value >= 0;

/** @type {Readonly<Record<string, PropertySpec>>} */
export const PROPERTIES = Object.freeze({
  'min-width': {
    css: 'min-width',
    type: 'dimension',
    tokens: ['dimension'],
    check: nonNegative,
  },
  'min-height': {
    css: 'min-height',
    type: 'dimension',
    tokens: ['dimension'],
    check: nonNegative,
  },
  material: {
    css: 'background-color',
    type: ['enum', 'regular', 'thin', 'thick'],
    tokens: [],
    write: (_v, ctx) => ctx.variable('color.surface'),
  },
  background: { css: 'background-color', type: 'color', tokens: ['color'] },
  color: { css: 'color', type: 'color', tokens: ['color'] },
  radius: {
    css: 'border-radius',
    type: 'dimension',
    max: 4,
    tokens: ['dimension'],
    check: nonNegative,
  },
  padding: {
    css: 'padding',
    type: 'dimension',
    max: 4,
    tokens: ['dimension'],
    check: nonNegative,
  },
  gap: {
    css: 'gap',
    type: 'dimension',
    max: 2,
    tokens: ['dimension'],
    check: nonNegative,
  },
  opacity: {
    css: 'opacity',
    type: 'number',
    tokens: ['number'],
    check: (v) => v.type !== 'number' || (v.value >= 0 && v.value <= 1),
    expected: 'a number from 0 to 1',
  },
  elevation: {
    css: 'box-shadow',
    type: 'number',
    tokens: [],
    check: (v) =>
      v.type === 'number' && Number.isInteger(v.value) && v.value >= 0,
    write: (v, ctx) => ctx.variable(`elevation.${v.value}`),
    expected: 'an elevation level (a whole number from 0)',
  },
  scale: {
    css: 'transform',
    type: 'number',
    tokens: ['number'],
    check: (v) => v.type !== 'number' || v.value >= 0,
    write: (v, ctx) => `scale(${values.toCss(v, ctx)})`,
  },
  'font-size': {
    css: 'font-size',
    type: 'dimension',
    tokens: ['dimension'],
    check: nonNegative,
  },
  'font-weight': {
    css: 'font-weight',
    type: 'number',
    tokens: ['fontWeight', 'number'],
    check: (v) => v.type !== 'number' || (v.value >= 1 && v.value <= 1000),
    expected: 'a font weight from 1 to 1000',
  },
  'border-width': {
    css: 'border-width',
    type: 'dimension',
    tokens: ['dimension'],
    check: nonNegative,
  },
  'border-color': { css: 'border-color', type: 'color', tokens: ['color'] },
  'outline-width': {
    css: 'outline-width',
    type: 'dimension',
    tokens: ['dimension'],
    check: nonNegative,
  },
  'outline-offset': {
    css: 'outline-offset',
    type: 'dimension',
    tokens: ['dimension'],
  },
  'outline-color': { css: 'outline-color', type: 'color', tokens: ['color'] },
  'outline-style': {
    css: 'outline-style',
    type: ['enum', 'none', 'solid', 'dashed', 'dotted', 'double'],
    tokens: [],
  },
  direction: {
    css: 'flex-direction',
    type: ['enum', 'horizontal', 'vertical'],
    tokens: [],
    write: (v) => (v.value === 'horizontal' ? 'row' : 'column'),
    expected: 'horizontal or vertical',
  },
});

/** Whether `name` is a style property. */
export const isStyleProperty = (name) => Object.hasOwn(PROPERTIES, name);

const expectedText = (spec) =>
  spec.expected ??
  `a ${Array.isArray(spec.type) ? spec.type.slice(1).join(' or ') : spec.type}${spec.tokens.length > 0 ? ' or (token PATH)' : ''}`;

const isRef = (v) => v.type === 'token-ref';

/** Whether one typed value is acceptable for the property. */
function acceptable(spec, value) {
  if (isRef(value)) {
    return spec.tokens.length > 0;
  }
  if (value.type === 'fallback') {
    return (
      spec.tokens.length > 0 &&
      value.options.every((option) => acceptable(spec, option))
    );
  }
  if (value.type === 'param' || value.type === 'element-ref') {
    return false;
  }
  return spec.check === undefined || spec.check(value);
}

/** Atom text of a raw value for diagnostics. */
export const rawText = (raw) =>
  values.formatValue(
    typeof raw === 'string'
      ? { type: 'string', value: raw }
      : values.inferValue(raw)
  );

/**
 * Type the values of one declaration `(NAME VALUE...)`.
 * @param {string} name  a style property (see {@link isStyleProperty})
 * @param {RawValue[]} raws
 * @param {Record<string, any>} at  where diagnostics point
 * @param {Diagnostic[]} diagnostics
 * @returns {import('./types.js').Decl|null}
 */
export function typeDeclaration(name, raws, at, diagnostics) {
  const spec = PROPERTIES[name];
  const where = { ...at, property: name, expected: expectedText(spec) };
  if (raws.length === 0 || raws.length > (spec.max ?? 1)) {
    diagnostics.push(
      styleDiagnostic('invalid-value', 'error', {
        ...where,
        text: raws.map(rawText).join(' '),
      })
    );
    return null;
  }
  const typed = [];
  for (const raw of raws) {
    const result = values.typeValue(raw, { type: spec.type });
    const value = result.value;
    if (value === null || !acceptable(spec, value)) {
      diagnostics.push(
        styleDiagnostic('invalid-value', 'error', {
          ...where,
          text: rawText(raw),
        })
      );
      return null;
    }
    typed.push(value);
  }
  return {
    property: name,
    value: typed.length === 1 ? typed[0] : { type: 'list', items: typed },
  };
}

/**
 * The CSS text of a declaration value.
 * @param {import('./types.js').Decl} decl
 * @param {CssContext} ctx
 * @returns {string}
 */
export function declarationCss(decl, ctx) {
  const spec = PROPERTIES[decl.property];
  // `write` sees token references only where `tokens` allows them (scale).
  const one = (v) =>
    spec.write === undefined ? values.toCss(v, ctx) : spec.write(v, ctx);
  return decl.value.type === 'list'
    ? decl.value.items.map(one).join(' ')
    : one(decl.value);
}
