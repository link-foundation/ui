/**
 * Selector matching and the cascade order.
 *
 * - `matches(selector, node, ancestors)`: whether an element matches;
 *   `ancestors` go from the root to the parent.
 * - `specificity(selector, states)`: `[ids, props + states, types]`, the
 *   tuple CSS computes for the selector that `compileCss` writes.
 * - `flatten(rules)`: every rule and block as one entry in the order
 *   `compileCss` writes them, so that "later wins" means the same thing for
 *   `resolveStyle` and for a browser.
 */

/**
 * @typedef {import('./types.js').Selector} Selector
 * @typedef {import('./types.js').UiNode} UiNode
 * @typedef {import('./types.js').StyleRule} StyleRule
 * @typedef {import('./types.js').Entry} Entry
 */

/** Whether `node` has the property `name` with the single value `value`. */
const hasProp = (node, name, value) =>
  node.properties.some(
    (p) => p.name === name && p.values.length === 1 && p.values[0] === value
  );

/** Whether `node` matches the compound part of `selector` (no `within`). */
const matchesCompound = (selector, node) =>
  (selector.type === null || node.kind === selector.type) &&
  (selector.id === null || node.id === selector.id) &&
  selector.props.every(({ name, value }) => hasProp(node, name, value));

/**
 * Whether `node` matches `selector`.
 * @param {Selector} selector
 * @param {UiNode} node
 * @param {UiNode[]} [ancestors]  from the root to the parent of `node`
 * @returns {boolean}
 */
export function matches(selector, node, ancestors = []) {
  return (
    matchesCompound(selector, node) &&
    selector.within.every((ancestor) =>
      ancestors.some((candidate, i) =>
        matches(ancestor, candidate, ancestors.slice(0, i))
      )
    )
  );
}

/**
 * The specificity `[ids, props + states, types]` of a selector, `within`
 * parts included (as for CSS descendant selectors).
 * @param {Selector} selector
 * @param {number} [states]  how many states the entry adds
 * @returns {[number, number, number]}
 */
export function specificity(selector, states = 0) {
  const result = [
    selector.id === null ? 0 : 1,
    selector.props.length + states,
    selector.type === null ? 0 : 1,
  ];
  for (const ancestor of selector.within) {
    const [a, b, c] = specificity(ancestor);
    result[0] += a;
    result[1] += b;
    result[2] += c;
  }
  return /** @type {[number, number, number]} */ (result);
}

/** Compare two specificity tuples: negative when `a` is lower. */
export function compareSpecificity(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

/**
 * Every rule and block as an entry, in the order `compileCss` writes them:
 * rules in source order, a rule's own declarations before its blocks,
 * blocks depth-first in source order.
 * @param {StyleRule[]} rules
 * @returns {Entry[]}
 */
export function flatten(rules) {
  /** @type {Entry[]} */
  const entries = [];
  const visit = (rule, states, at) => {
    entries.push({
      id: rule.id,
      index: entries.length,
      selector: rule.selector,
      states,
      at,
      declarations: rule.declarations,
    });
    for (const block of rule.blocks) {
      if (block.kind === 'state') {
        visit(block.rule, [...states, block.condition], at);
      } else {
        const conditions = /** @type {any} */ (block.condition);
        visit(block.rule, states, [...at, { kind: block.kind, conditions }]);
      }
    }
  };
  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    visit(rule, [], []);
  }
  return entries;
}
