/**
 * Checks that need the vocabulary types (docs/spec/values.md,
 * docs/spec/behaviour.md, docs/spec/ordering-and-ids.md). They run on the
 * projected tree and only add diagnostics; the tree is never changed.
 *
 * Every value check is a small character scanner: the package uses no
 * regular expressions, so no input can trigger catastrophic backtracking.
 */

import { diagnostic } from './diagnostics.js';

const isDigit = (c) => c >= '0' && c <= '9';
const isHexDigit = (c) =>
  isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
const isTokenChar = (c) => isDigit(c) || (c >= 'a' && c <= 'z') || c === '-';

/** Index after a run of characters accepted by `accept`, from `i`. */
function skip(text, i, accept) {
  let j = i;
  while (j < text.length && accept(text[j])) {
    j++;
  }
  return j;
}

/**
 * Length of the unsigned decimal at the start of `text` (`12`, `1.5`, `.5`),
 * or -1 when there is none.
 */
function decimalLength(text) {
  const whole = skip(text, 0, isDigit);
  if (text[whole] !== '.') {
    return whole > 0 ? whole : -1;
  }
  const fraction = skip(text, whole + 1, isDigit);
  return fraction > whole + 1 ? fraction : -1;
}

const unsigned = (text) => (text.startsWith('-') ? text.slice(1) : text);

/** `-1`, `0.5`, `.5`, `1e3`, `2.5E-2` */
export function isNumber(text) {
  const body = unsigned(text);
  const length = decimalLength(body);
  if (length < 0) {
    return false;
  }
  if (length === body.length) {
    return true;
  }
  if (body[length] !== 'e' && body[length] !== 'E') {
    return false;
  }
  let exponent = body.slice(length + 1);
  if (exponent.startsWith('-') || exponent.startsWith('+')) {
    exponent = exponent.slice(1);
  }
  return exponent.length > 0 && skip(exponent, 0, isDigit) === exponent.length;
}

/** A decimal followed by exactly one of `units`. */
function isQuantity(text, units) {
  const length = decimalLength(text);
  return length > 0 && units.includes(text.slice(length));
}

const DIMENSION_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh'];
const DURATION_UNITS = ['ms', 's'];
const HEX_LENGTHS = [3, 4, 6, 8];
const URL_PREFIXES = ['http:', 'https:', 'mailto:', '/', '.'];
const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];
const COLOUR_FUNCTIONS = ['oklch', 'rgb'];

export const isDimension = (text) =>
  text === '0' || isQuantity(unsigned(text), DIMENSION_UNITS);

export const isDuration = (text) => isQuantity(text, DURATION_UNITS);

export const isHexColour = (text) =>
  text.startsWith('#') &&
  HEX_LENGTHS.includes(text.length - 1) &&
  skip(text, 1, isHexDigit) === text.length;

export const isUrl = (text) =>
  !text.includes(':') || URL_PREFIXES.some((p) => text.startsWith(p));

/** `space.medium`, `colour-1`: lowercase segments joined by dots. */
export const isTokenName = (text) =>
  text
    .split('.')
    .every(
      (part) => part.length > 0 && skip(part, 0, isTokenChar) === part.length
    );

const hasReservedSigil = (text) => text.startsWith('@') || text.startsWith('$');

const STRING_CHECKS = {
  number: isNumber,
  dimension: isDimension,
  duration: isDuration,
  color: isHexColour,
  url: isUrl,
  'token-name': isTokenName,
};

function isFunctionalColour(value) {
  const [space, ...channels] = value;
  return (
    COLOUR_FUNCTIONS.includes(space) &&
    (channels.length === 3 || channels.length === 4) &&
    channels.every(
      (c) =>
        typeof c === 'string' && isNumber(c.endsWith('%') ? c.slice(0, -1) : c)
    )
  );
}

const isTypedReference = (value) =>
  Array.isArray(value) && ['token', 'param', 'or'].includes(value[0]);

/**
 * Whether a property value matches a vocabulary type.
 * @param {string|string[]|undefined} type
 * @param {import('./types.js').RawValue} value
 */
export function valueMatches(type, value) {
  if (typeof value === 'string' && hasReservedSigil(value)) {
    return true; // reported as reserved-sigil instead
  }
  if (isTypedReference(value)) {
    return value[0] === 'or'
      ? value.slice(1).every((v) => valueMatches(type, v))
      : value.length === 2 && typeof value[1] === 'string';
  }
  if (Array.isArray(type)) {
    return type[0] === 'enum' && type.slice(1).includes(value);
  }
  if (typeof value !== 'string') {
    if (type === 'color' && Array.isArray(value)) {
      return isFunctionalColour(value);
    }
    return type === 'any' || type === 'action';
  }
  return STRING_CHECKS[type]?.(value) ?? true;
}

const isUnsafeTarget = (target) => {
  const text = String(target ?? '')
    .trim()
    .toLowerCase();
  return UNSAFE_SCHEMES.some((scheme) => text.startsWith(scheme));
};

/** `(on <event> <action>...)`: actions are data, never code. */
function checkHandler(values, vocabulary, report, at) {
  const [event, ...actions] = values;
  if (typeof event !== 'string' || actions.length === 0) {
    report('invalid-handler', 'error', at);
    return;
  }
  for (const action of actions) {
    if (!Array.isArray(action)) {
      report('invalid-handler', 'error', at);
    } else if (!vocabulary.actions.has(action[0])) {
      report('unknown-action', 'warning', at);
    } else if (action[0] === 'navigate' && isUnsafeTarget(action[1])) {
      report('unsafe-url', 'error', at);
    }
  }
}

function eachString(value, visit) {
  if (typeof value === 'string') {
    visit(value);
  } else {
    const values = Array.isArray(value) ? value : value.values;
    values.forEach((v) => eachString(v, visit));
  }
}

function checkProperty(element, property, spec, vocabulary, report) {
  const at = { element: element.id, property: property.name };
  property.values.forEach((v) =>
    eachString(v, (text) => {
      if (hasReservedSigil(text)) {
        report('reserved-sigil', 'warning', at);
      }
    })
  );
  const type = spec?.properties.get(property.name)?.type;
  if (type === 'action') {
    checkHandler(property.values, vocabulary, report, at);
    return;
  }
  if (type === undefined || type === 'any' || type === 'string') {
    return;
  }
  for (const value of property.values) {
    if (!valueMatches(type, value)) {
      report('invalid-value', 'error', at);
    }
  }
}

function checkElement(element, vocabulary, report) {
  const spec = vocabulary.kinds.get(element.kind);
  for (const text of element.positional) {
    if (hasReservedSigil(text)) {
      report('reserved-sigil', 'warning', { element: element.id });
    }
  }
  for (const property of element.properties) {
    checkProperty(element, property, spec, vocabulary, report);
  }
  if (spec?.children === 'none' && element.children.length > 0) {
    report('unexpected-child', 'warning', { element: element.id });
  }
  for (const child of element.children) {
    checkElement(child, vocabulary, report);
  }
}

/** Token references inside a token value: `(token name)` anywhere. */
function tokenReferences(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value[0] === 'token' ? [value[1]] : value.flatMap(tokenReferences);
}

/** Themes by id: their own tokens and the theme they extend. */
function readThemes(roots) {
  const themes = new Map();
  for (const element of roots) {
    if (element.kind !== 'theme' || element.id === null) {
      continue;
    }
    const tokens = new Map();
    let base = null;
    for (const { name, values } of element.properties) {
      if (name === 'token') {
        tokens.set(values[0], values[1]);
      } else if (name === 'extends') {
        base = values[0];
      }
    }
    themes.set(element.id, { tokens, base });
  }
  return themes;
}

/** The value of a token as seen from `theme`, following `extends`. */
function resolveToken(themes, theme, name) {
  const seen = new Set();
  for (let t = theme; themes.has(t) && !seen.has(t); t = themes.get(t).base) {
    seen.add(t);
    const { tokens } = themes.get(t);
    if (tokens.has(name)) {
      return tokens.get(name);
    }
  }
  return undefined;
}

/** Whether following the references of `name` comes back to `name`. */
function reachesItself(themes, theme, name) {
  const visited = new Set();
  const pending = tokenReferences(resolveToken(themes, theme, name));
  while (pending.length > 0) {
    const next = pending.pop();
    if (next === name) {
      return true;
    }
    if (!visited.has(next)) {
      visited.add(next);
      pending.push(...tokenReferences(resolveToken(themes, theme, next)));
    }
  }
  return false;
}

function checkTokenCycles(roots, report) {
  const themes = readThemes(roots);
  for (const [theme, { tokens }] of themes) {
    for (const token of tokens.keys()) {
      if (reachesItself(themes, theme, token)) {
        report('reference-cycle', 'error', {
          element: theme,
          property: 'token',
          token,
        });
      }
    }
  }
}

/**
 * Run all vocabulary checks over projected roots.
 * @param {import('./types.js').UiNode[]} roots
 * @param {import('./types.js').Vocabulary} vocabulary
 * @param {import('./types.js').Diagnostic[]} diagnostics appended to
 */
export function checkTree(roots, vocabulary, diagnostics) {
  const report = (code, severity, at) =>
    diagnostics.push(diagnostic(code, severity, at));
  for (const element of roots) {
    checkElement(element, vocabulary, report);
  }
  checkTokenCycles(roots, report);
}
