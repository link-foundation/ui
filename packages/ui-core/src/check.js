/**
 * Checks that need the vocabulary types (docs/spec/values.md,
 * docs/spec/behaviour.md, docs/spec/ordering-and-ids.md). They run on the
 * projected tree and only add diagnostics; the tree is never changed.
 *
 * Value types are checked by the value layer (src/values/), whose scanners
 * use no regular expressions, so no input can trigger catastrophic
 * backtracking.
 */

import { diagnostic } from './diagnostics.js';
import { sigilDiagnostics } from './values/refs.js';
import { hasReservedSigil } from './values/scalars.js';
import { valueMatches } from './values/typed.js';

export { valueMatches };

const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

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

function checkProperty(element, property, spec, vocabulary, report) {
  const at = { element: element.id, property: property.name };
  for (const value of property.values) {
    for (const { code, severity } of sigilDiagnostics(value)) {
      report(code, severity, at);
    }
  }
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
