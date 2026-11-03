/**
 * The dev mode policy of a site: the `dev-mode` link of the site
 * configuration. It can turn dev mode off, restrict its entry points, the
 * configuration layers an edit may write and the elements that stay
 * read-only.
 *
 * ```lino
 * (site-dev-mode: dev-mode
 *   (enabled true)
 *   (entry shortcut url-parameter element)
 *   (shortcut 'Alt+Shift+D')
 *   (write-layers session user)
 *   (locked-elements payment-form))
 * ```
 *
 * The text is read with ui-core `parse` (the official `links-notation`
 * parser); this module never parses Links Notation itself.
 */

import { parse } from '@link-foundation/ui-core';

/** The kind of the policy link. */
export const POLICY_KIND = 'dev-mode';

/** The entry points of dev mode, in the order they are documented. */
export const ENTRY_POINTS = Object.freeze([
  'shortcut',
  'url-parameter',
  'element',
]);

/** The layers dev mode may write, lowest first (ui-config `EDITABLE_LAYERS`). */
export const WRITABLE_LAYERS = Object.freeze(['user', 'session']);

/** The shortcut when the policy names none. */
export const DEFAULT_SHORTCUT = 'Alt+Shift+D';

/** The configuration layers dev mode never writes. */
const READ_ONLY_LAYERS = new Set(['defaults', 'theme', 'site']);

/**
 * @typedef {object} PolicyWarning
 * @property {string} code  `unknown-key`, `unknown-entry`, `unknown-layer`,
 *   `read-only-layer`, `bad-value` or `duplicate-policy`
 * @property {'warning'} severity
 * @property {string} message
 * @property {Record<string, unknown>} at
 *
 * @typedef {object} DevModePolicy
 * @property {boolean} enabled
 * @property {ReadonlySet<string>} entry  entry points that may open dev mode
 * @property {string} shortcut  the key combination, `Alt+Shift+D` by default
 * @property {readonly ('user'|'session')[]} writeLayers  lowest first
 * @property {ReadonlySet<string>} lockedElements  read-only element ids
 * @property {readonly PolicyWarning[]} warnings
 */

const warning = (code, message, at = {}) =>
  Object.freeze({ code, severity: 'warning', message, at: Object.freeze(at) });

/** The ui-core nodes of the input, depth first. */
function nodesOf(input) {
  if (input === undefined || input === null) {
    return [];
  }
  const roots =
    typeof input === 'string'
      ? parse(input).roots
      : Array.isArray(input)
        ? input
        : (input.roots ?? [input]);
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    (node.children ?? []).forEach(visit);
  };
  roots.forEach(visit);
  return nodes;
}

/**
 * The sublinks of a policy node as `[name, values]`: the links ui-core keeps
 * as `unknown` (the vocabulary has no `dev-mode` kind) and, should the kind
 * be declared, its properties.
 */
const entriesOf = (node) => [
  ...(node.unknown ?? [])
    .filter((raw) => Array.isArray(raw) && typeof raw[0] === 'string')
    .map(([name, ...values]) => [name, values]),
  ...(node.properties ?? []).map((p) => [p.name, p.values]),
];

const atoms = (values) => values.filter((v) => typeof v === 'string');

const READERS = {
  enabled(policy, values, report) {
    const [value] = values;
    if (values.length !== 1 || (value !== 'true' && value !== 'false')) {
      report('bad-value', '(enabled …) takes true or false', {
        key: 'enabled',
      });
      return;
    }
    policy.enabled = value === 'true';
  },
  entry(policy, values, report) {
    policy.entry = new Set();
    for (const value of atoms(values)) {
      if (ENTRY_POINTS.includes(value)) {
        policy.entry.add(value);
      } else {
        report('unknown-entry', `Unknown entry point "${value}"`, { value });
      }
    }
  },
  shortcut(policy, values, report) {
    if (values.length !== 1 || typeof values[0] !== 'string') {
      report('bad-value', "(shortcut …) takes one key such as 'Alt+Shift+D'", {
        key: 'shortcut',
      });
      return;
    }
    policy.shortcut = values[0];
  },
  'write-layers'(policy, values, report) {
    const layers = new Set();
    for (const value of atoms(values)) {
      if (WRITABLE_LAYERS.includes(value)) {
        layers.add(value);
      } else if (READ_ONLY_LAYERS.has(value)) {
        report(
          'read-only-layer',
          `Dev mode never writes the ${value} layer; it is ignored`,
          { value }
        );
      } else {
        report('unknown-layer', `Unknown layer "${value}"`, { value });
      }
    }
    policy.writeLayers = WRITABLE_LAYERS.filter((layer) => layers.has(layer));
  },
  'locked-elements'(policy, values) {
    policy.lockedElements = new Set(atoms(values));
  },
};

/**
 * The default policy: enabled, every entry point, `Alt+Shift+D`, writes to
 * `session` and `user`, nothing locked.
 * @returns {DevModePolicy}
 */
export const defaultPolicy = () =>
  freezePolicy({
    enabled: true,
    entry: new Set(ENTRY_POINTS),
    shortcut: DEFAULT_SHORTCUT,
    writeLayers: [...WRITABLE_LAYERS],
    lockedElements: new Set(),
    warnings: [],
  });

function freezePolicy(policy) {
  return Object.freeze({
    ...policy,
    entry: Object.freeze(policy.entry),
    writeLayers: Object.freeze([...policy.writeLayers]),
    lockedElements: Object.freeze(policy.lockedElements),
    warnings: Object.freeze([...policy.warnings]),
  });
}

/**
 * Read the dev mode policy from the site configuration.
 *
 * `links` is Links Notation text, a ui-core document (`parse`), or a list of
 * ui-core nodes. The first element of kind `dev-mode` (at any depth) is
 * the policy; without one the defaults apply. Unknown keys, entry points
 * and layers are warnings, never errors.
 * @param {string|{roots: readonly object[]}|readonly object[]|null} [links]
 * @returns {DevModePolicy}
 */
export function parseDevModePolicy(links) {
  const policy = { ...defaultPolicy() };
  policy.warnings = [];
  const report = (code, message, at) =>
    policy.warnings.push(warning(code, message, at));
  const found = nodesOf(links).filter((node) => node.kind === POLICY_KIND);
  if (found.length > 1) {
    report(
      'duplicate-policy',
      `Only the first ${POLICY_KIND} link is read; "${found[1].id}" is ignored`,
      { element: found[1].id }
    );
  }
  for (const [name, values] of found.length > 0 ? entriesOf(found[0]) : []) {
    const read = Object.hasOwn(READERS, name) ? READERS[name] : null;
    if (read === null) {
      report('unknown-key', `Unknown dev mode key "${name}"; it is ignored`, {
        key: name,
      });
    } else {
      read(policy, values, report);
    }
  }
  return freezePolicy(policy);
}
