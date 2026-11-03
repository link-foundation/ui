/**
 * The read-only tabs of the inspector, without a DOM: the style rules that
 * match an element, the design tokens it uses, the animations that target
 * it and its Links Notation source. Every function here is pure.
 */

import { format, values as uiValues } from '@link-foundation/ui-core';
import { flatten, matches } from '@link-foundation/ui-style';
import { formatValues, tokenPath } from './model.js';

/** A typed value (ui-core `values`) as text; a colour as CSS (`#6750A4`). */
export function formatTyped(value) {
  if (value?.type === 'color') {
    return uiValues.colorCss(value);
  }
  return uiValues.formatValue(value);
}

const formatAt = ({ kind, conditions }) =>
  `${kind} ${conditions
    .map((c) => `(${c.feature} ${formatTyped(c.value)})`)
    .join(' ')}`;

/**
 * The ancestors of an element, from the root to its parent.
 * @param {string} id
 * @param {{ get: (id: string) => object|undefined,
 *   parentOf: (id: string) => string|null }} tree  a ui-store store
 */
export function ancestorsOf(id, tree) {
  const out = [];
  for (let at = tree.parentOf(id); at; at = tree.parentOf(at)) {
    out.unshift(tree.get(at));
  }
  return out;
}

/**
 * @typedef {object} StyleMatch
 * @property {string} rule  the id of the style rule
 * @property {readonly string[]} states  `hover`, `pressed`, …
 * @property {readonly string[]} at  media and container conditions
 * @property {{ property: string, text: string, token: string|null }[]} declarations
 */

/**
 * The style entries (base rule, states, media blocks) that match an
 * element, in cascade order.
 * @param {object} element  a ui-core node or ui-store view
 * @param {readonly object[]} ancestors  from the root to the parent
 * @param {readonly object[]} rules  ui-style `readStyles(…).rules`
 * @returns {StyleMatch[]}
 */
export function matchingStyles(element, ancestors, rules) {
  return flatten(rules ?? [])
    .filter((entry) => matches(entry.selector, element, ancestors))
    .map((entry) => ({
      rule: entry.id,
      states: entry.states,
      at: entry.at.map(formatAt),
      declarations: entry.declarations.map(({ property, value }) => ({
        property,
        text: formatTyped(value),
        token: value.type === 'token-ref' ? value.path : null,
      })),
    }));
}

/**
 * The animations that target an element: `(target id)`.
 * @param {string} id
 * @param {readonly object[]} nodes  ui-core nodes (any kind; the
 *   `animation` ones are read)
 * @returns {{ id: string, source: string,
 *   properties: { name: string, text: string, token: string|null }[] }[]}
 */
export function animationsOf(id, nodes) {
  const target = (node) =>
    node.properties.find((p) => p.name === 'target')?.values[0];
  return (nodes ?? [])
    .filter((node) => node.kind === 'animation' && target(node) === id)
    .map((node) => ({
      id: node.id,
      properties: node.properties.map(({ name, values }) => ({
        name,
        text: formatValues(values),
        token: tokenPath(values),
      })),
      source: sourceOf(node),
    }));
}

/**
 * The Links Notation source of one element (with its children), written by
 * ui-core `format` in the nested form.
 * @param {object} node  a ui-core node
 */
export const sourceOf = (node) =>
  format({ roots: [node], unknown: [] }).trimEnd();

/**
 * The tokens an element uses: the token references of its properties, of
 * the style rules that match it and of the animations that target it.
 * @param {{ rows: readonly { label: string, value?: readonly unknown[] }[],
 *   styles: readonly StyleMatch[],
 *   animations: readonly { id: string,
 *     properties: { name: string, token: string|null }[] }[] }} uses
 * @param {Map<string, { value: object, set: string }>|undefined} tokens
 *   ui-tokens `resolveTokens(…)`
 * @param {(path: string) => { value: readonly unknown[], layer: string }|undefined} [resolveOverride]
 *   the value of a token in the configuration, when a layer overrides it
 * @returns {{ path: string, usedBy: string[], text: string, css: string|null, layer: string }[]}
 */
export function tokensUsed(uses, tokens, resolveOverride) {
  const found = new Map();
  const use = (path, by) => {
    if (path === null) {
      return;
    }
    const list = found.get(path) ?? [];
    if (!list.includes(by)) {
      list.push(by);
    }
    found.set(path, list);
  };
  for (const row of uses.rows) {
    use(tokenPath(row.value), row.label);
  }
  for (const style of uses.styles) {
    for (const decl of style.declarations) {
      use(decl.token, `${style.rule} ${decl.property}`);
    }
  }
  for (const animation of uses.animations) {
    for (const { name, token } of animation.properties) {
      use(token, `${animation.id} ${name}`);
    }
  }
  return [...found].map(([path, usedBy]) => {
    const override = resolveOverride?.(path);
    const token = tokens?.get(path);
    const text = override
      ? formatValues(override.value)
      : token
        ? formatTyped(token.value)
        : '';
    const css =
      !override && token?.value?.type === 'color'
        ? uiValues.colorCss(token.value)
        : null;
    return {
      path,
      usedBy,
      text,
      css,
      layer: override?.layer ?? (token ? 'theme' : 'defaults'),
    };
  });
}
