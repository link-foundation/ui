/**
 * `resolveStyle(rules, tokens, node, ancestors, env)`: the style of one
 * element in one state and environment, with token references replaced by
 * their values. This is what native renderers (React Native, SwiftUI,
 * Compose) use where the DOM renderer uses CSS.
 *
 * The cascade is the one of CSS for the stylesheet `compileCss` writes:
 * the highest specificity wins, then the later entry (see match.js).
 */

import { conditionHolds } from './conditions.js';
import { styleDiagnostic } from './diagnostics.js';
import { compareSpecificity, flatten, matches, specificity } from './match.js';
import { PROPERTIES } from './properties.js';

/**
 * @typedef {import('./types.js').StyleRule} StyleRule
 * @typedef {import('./types.js').StyleEnv} StyleEnv
 * @typedef {import('./types.js').TypedValue} TypedValue
 * @typedef {import('./types.js').UiNode} UiNode
 * @typedef {import('./types.js').Diagnostic} Diagnostic
 */

/** Whether every state and condition of an entry holds. */
const applies = (entry, states, env) =>
  entry.states.every((state) => states.has(state)) &&
  entry.at.every(({ kind, conditions }) =>
    conditions.every((condition) => conditionHolds(kind, condition, env))
  );

/**
 * A token as `{ type, value }`. `tokens` maps a path to a ui-tokens
 * `ResolvedToken` (`resolveTokens`) or directly to a typed value.
 * @returns {{ type: string|null, value: TypedValue }|null}
 */
function lookupToken(tokens, path) {
  const entry = tokens?.get(path);
  if (entry === undefined || entry === null) {
    return null;
  }
  return 'path' in entry && 'value' in entry
    ? { type: entry.type, value: entry.value }
    : { type: entry.type, value: entry };
}

/**
 * Replace token references by their values; `null` (with a diagnostic) when
 * a token is missing or of the wrong type.
 * @param {TypedValue} value
 * @param {Record<string, any>} at
 * @param {{ tokens: Map<string, any>, diagnostics: Diagnostic[] | null }} ctx
 * @returns {TypedValue|null}
 */
function resolveValue(value, at, ctx) {
  const spec = PROPERTIES[at.property];
  switch (value.type) {
    case 'token-ref': {
      const token = lookupToken(ctx.tokens, value.path);
      if (token === null) {
        ctx.diagnostics?.push(
          styleDiagnostic('unknown-token', 'error', {
            ...at,
            token: value.path,
          })
        );
        return null;
      }
      const type = token.type ?? token.value.type;
      if (!spec.tokens.includes(type)) {
        ctx.diagnostics?.push(
          styleDiagnostic('type-mismatch', 'error', {
            ...at,
            token: value.path,
            expected: spec.tokens.join(' or '),
            actual: type,
          })
        );
        return null;
      }
      return token.value;
    }
    case 'fallback': {
      // The first option that resolves, as `var(--a, var(--b, 1px))`.
      for (const option of value.options) {
        const resolved = resolveValue(option, at, {
          ...ctx,
          diagnostics: null,
        });
        if (resolved !== null) {
          return resolved;
        }
      }
      return resolveValue(value.options[value.options.length - 1], at, ctx);
    }
    case 'list': {
      const items = value.items.map((item) => resolveValue(item, at, ctx));
      return items.includes(null)
        ? null
        : { type: 'list', items: /** @type {TypedValue[]} */ (items) };
    }
    default:
      return value;
  }
}

/**
 * The resolved style of one element.
 * @param {StyleRule[]} rules
 * @param {Map<string, any>} tokens  ui-tokens `resolveTokens` output, or
 *   any map of token path -> typed value
 * @param {UiNode} node
 * @param {UiNode[]} [ancestors]  from the root to the parent of `node`
 * @param {StyleEnv} [env]
 * @returns {{ style: Record<string, TypedValue>, sources: Record<string, string>,
 *   diagnostics: Diagnostic[] }}  `sources` gives the rule id per property
 */
export function resolveStyle(rules, tokens, node, ancestors = [], env = {}) {
  const states = new Set(env.states ?? []);
  /** @type {Map<string, { spec: number[], decl: any, id: string }>} */
  const winners = new Map();
  for (const entry of flatten(rules)) {
    if (
      entry.declarations.length === 0 ||
      !applies(entry, states, env) ||
      !matches(entry.selector, node, ancestors)
    ) {
      continue;
    }
    const spec = specificity(entry.selector, entry.states.length);
    for (const decl of entry.declarations) {
      const current = winners.get(decl.property);
      // Entries come in cascade order, so an equal specificity wins.
      if (
        current === undefined ||
        compareSpecificity(spec, current.spec) >= 0
      ) {
        winners.set(decl.property, { spec, decl, id: entry.id });
      }
    }
  }
  /** @type {Record<string, TypedValue>} */
  const style = {};
  /** @type {Record<string, string>} */
  const sources = {};
  /** @type {Diagnostic[]} */
  const diagnostics = [];
  for (const [property, { decl, id }] of winners) {
    const value = resolveValue(
      decl.value,
      { rule: id, property },
      { tokens, diagnostics }
    );
    if (value !== null) {
      style[property] = value;
      sources[property] = id;
    }
  }
  return { style, sources, diagnostics };
}
