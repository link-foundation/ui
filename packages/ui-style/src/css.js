/**
 * `compileCss(rules, options)`: style rules as a CSS stylesheet for the DOM
 * renderer, whose elements are `ui-KIND` with the element properties as
 * attributes (`ui-button[variant='filled']`).
 *
 * Token references become `var(--color-primary)` (the naming rule of
 * ui-tokens `cssVariable`), so a theme switch only swaps custom properties.
 * Every identifier is escaped as by `CSS.escape` and every attribute value
 * is a quoted, escaped CSS string. Declaration values are typed values
 * written by ui-core `values.toCss`: no free text, and never `url(`.
 */

import { cssVariable } from '@link-foundation/ui-tokens';
import { STATE_CSS, conditionsCss } from './conditions.js';
import { flatten } from './match.js';
import { materialCss } from './materials.js';
import { PROPERTIES, declarationCss } from './properties.js';

/** A theme boundary can itself be the selected control. */
function scopedSelector(selector, scope, atRoot) {
  // The enclosing @scope bounds descendants, including ancestors at its root.
  if (scope === ':scope') {
    return `${selector}, ${atRoot}`;
  }
  return scope ? `${scope} ${selector}, ${atRoot}` : selector;
}

/**
 * @typedef {import('./types.js').StyleRule} StyleRule
 * @typedef {import('./types.js').Selector} Selector
 *
 * @typedef {object} CompileOptions
 * @property {(kind: string) => string} [tagFor]  the CSS selector of an
 *   element kind (default `ui-KIND`, escaped); its result is used verbatim
 * @property {'on'|'off'} [transparency] effective transparency comfort choice
 * @property {boolean} [reducedTransparency] omit all translucent material rules
 * @property {string} [scope] theme boundary selector (includes the boundary itself)
 * @property {string} [prefix]  the custom property prefix of ui-tokens
 *   `toCss` (`md` gives `var(--md-color-primary)`)
 */

const hex = (c) => `\\${c.codePointAt(0).toString(16)} `;
const disabledControl = `:is([disabled], [aria-disabled='true'], :has([data-part='input']:disabled), :has([data-part='thumb'][aria-disabled='true']))`;
const HOST_STATES = {
  hover: `:hover:not(${disabledControl})`,
  pressed: `:active:not(${disabledControl})`,
  active: `:active:not(${disabledControl})`,
  disabled: disabledControl,
  checked: `:has([data-part='input']:is(:checked, [aria-checked='true']))`,
};
const isControl = (code) => code <= 0x1f || code === 0x7f;
const isDigit = (c) => c >= '0' && c <= '9';

/**
 * The escape of one character shared by identifiers and strings: U+0000
 * becomes U+FFFD, control characters a hex escape; `null` otherwise.
 */
function escapeSpecial(c) {
  const code = c.codePointAt(0);
  if (code === 0) {
    return '�';
  }
  return isControl(code) ? hex(c) : null;
}

/**
 * Escape a CSS identifier as `CSS.escape` does (CSSOM, "serialize an
 * identifier").
 * @param {string} text
 * @returns {string}
 */
export function escapeIdentifier(text) {
  const chars = [...text];
  return chars
    .map((c, i) => {
      const special = escapeSpecial(c);
      if (special !== null) {
        return special;
      }
      if ((i === 0 || (i === 1 && chars[0] === '-')) && isDigit(c)) {
        return hex(c);
      }
      if (i === 0 && c === '-' && chars.length === 1) {
        return '\\-';
      }
      return c.codePointAt(0) >= 0x80 || /[-_a-zA-Z0-9]/u.test(c)
        ? c
        : `\\${c}`;
    })
    .join('');
}

/**
 * A CSS string in single quotes: `'`, `\` and control characters escaped.
 * @param {string} text
 * @returns {string}
 */
export function quoteString(text) {
  const body = [...text]
    .map((c) => escapeSpecial(c) ?? (c === "'" || c === '\\' ? `\\${c}` : c))
    .join('');
  return `'${body}'`;
}

/** The selector of one element: `ui-button#ok[variant='filled']`. */
function compound(selector, tagFor, hostStates = '') {
  const text =
    (selector.type === null ? '' : tagFor(selector.type)) +
    (selector.id === null ? '' : `#${escapeIdentifier(selector.id)}`) +
    selector.props
      .filter(({ name }) => name !== 'part')
      .map(
        ({ name, value }) => `[${escapeIdentifier(name)}=${quoteString(value)}]`
      )
      .join('');
  const part = selector.props.find(({ name }) => name === 'part');
  return (
    (text === '' ? '*' : text) +
    hostStates +
    (part ? ` [data-part=${quoteString(part.value)}]` : '')
  );
}

/**
 * The selector with its ancestors: the first `within` is a descendant
 * combinator, every further one an `:is(ANCESTOR *)` (same specificity).
 * @param {Selector} selector
 * @param {(kind: string) => string} tagFor
 * @param {string} [suffix]  pseudo-classes of the states
 * @returns {string}
 */
function selectorCss(
  selector,
  tagFor,
  suffix = '',
  hostStates = '',
  atRoot = ''
) {
  const [first, ...rest] = selector.within;
  const own =
    compound(selector, tagFor, hostStates) +
    rest.map((ancestor) => `:is(${selectorCss(ancestor, tagFor)} *)`).join('') +
    suffix;
  if (first !== undefined) {
    return `${selectorCss(first, tagFor, '', '', atRoot)} ${own}`;
  }
  if (!atRoot) {
    return own;
  }
  const part = selector.props.find(({ name }) => name === 'part');
  if (!part) {
    return `${atRoot}:is(${own})`;
  }
  const host = {
    ...selector,
    props: selector.props.filter(({ name }) => name !== 'part'),
  };
  return `${atRoot}:is(${compound(host, tagFor, hostStates)}) [data-part=${quoteString(part.value)}]${suffix}`;
}

/** Keep only the last declaration of each property, at its position. */
function lastDeclarations(declarations) {
  const last = new Map();
  declarations.forEach((decl, i) => last.set(decl.property, i));
  return declarations.filter((decl, i) => last.get(decl.property) === i);
}

/**
 * Write the rules as a CSS stylesheet.
 * @param {StyleRule[]} rules
 * @param {CompileOptions} [options]
 * @returns {string}
 */
export function compileCss(rules, options = {}) {
  const { tagFor = (kind) => `ui-${escapeIdentifier(kind)}`, prefix = '' } =
    options;
  const refToVar = (ref, fallback) =>
    `var(${cssVariable(ref.path, prefix)}${fallback === undefined ? '' : `, ${fallback}`})`;
  const ctx = {
    refToVar,
    variable: (path) => refToVar({ type: 'token-ref', path }),
  };
  let css = '';
  for (const entry of flatten(rules)) {
    if (entry.declarations.length === 0) {
      continue;
    }
    const states = entry.states.map((state) => STATE_CSS[state]).join('');
    const part = entry.selector.props.find(({ name }) => name === 'part');
    // Control interaction states also reach non-interactive visual parts.
    const hostStates = part
      ? entry.states
          .filter((state) => Object.hasOwn(HOST_STATES, state))
          .map((state) => HOST_STATES[state])
          .join('')
      : '';
    const partStates = part
      ? entry.states
          .filter((state) => !Object.hasOwn(HOST_STATES, state))
          .map((state) => STATE_CSS[state])
          .join('')
      : states;
    const selector = selectorCss(
      entry.selector,
      tagFor,
      partStates,
      hostStates
    );
    const atRoot = selectorCss(
      entry.selector,
      tagFor,
      partStates,
      hostStates,
      `:where(:scope)${options.scope === ':scope' ? '' : (options.scope ?? '')}`
    );
    const depth = entry.at.length;
    const pad = '  '.repeat(depth);
    const lines = [
      ...entry.at.map(
        ({ kind, conditions }, i) =>
          `${'  '.repeat(i)}@${kind} ${conditionsCss(conditions)} {`
      ),
      `${pad}${scopedSelector(selector, options.scope, atRoot)} {`,
      ...lastDeclarations(entry.declarations).map(
        (decl) =>
          `${pad}  ${PROPERTIES[decl.property].css}: ${declarationCss(decl, ctx)};`
      ),
      `${pad}}`,
      ...entry.at.map((_, i) => `${'  '.repeat(depth - 1 - i)}}`),
    ];
    css += `${lines.join('\n')}\n`;
    const material = lastDeclarations(entry.declarations).find(
      (decl) => decl.property === 'material'
    );
    if (material) {
      css += materialCss(
        material.value.value,
        scopedSelector(selector, options.scope, atRoot),
        entry.at,
        options
      );
    }
  }
  return css;
}
