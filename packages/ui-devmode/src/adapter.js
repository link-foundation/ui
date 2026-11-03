/** The shared inspector contract for ui-dom and foreign pages. */
import { defaultVocabulary } from '@link-foundation/ui-core';
import { applyEdit, propertyRows, topWritableLayer } from './model.js';

/**
 * @typedef {object} PageAdapter
 * @property {() => object} tree A store-shaped view of the imported document.
 * @property {(id: string) => Node|null} nodeFor
 * @property {(node: Node) => string|null} idFor
 * @property {(id: string, name: string|object, value: unknown) => object} applyProperty
 * @property {(callback: () => void) => () => void} observe
 * @property {(id: string) => object[]} rows Property grid presentation.
 */

/**
 * The tree of the document read from the effective configuration, for a
 * page that passes no ui-store store. Same shape as a store.
 */
export function documentTree(config) {
  let doc = null;
  const parents = new Map();
  const load = () => {
    if (doc === null) {
      doc = config.effective();
      parents.clear();
      const walk = (node, parent) => {
        parents.set(node.id, parent);
        (node.children ?? []).forEach((child) => walk(child, node.id));
      };
      doc.roots.forEach((node) => walk(node, null));
    }
    return doc;
  };
  return {
    get: (id) => load().byId.get(id),
    roots: () => load().roots.map((node) => node.id),
    children: (id) =>
      (load().byId.get(id)?.children ?? []).map((node) => node.id),
    parentOf: (id) => (load(), parents.get(id) ?? null),
    toDocument: load,
    subscribe: (listener) =>
      config.subscribe((...args) => {
        doc = null;
        listener(...args);
      }),
  };
}

/** Adapt an existing ui-dom page without changing its edit or pick behavior. */
export function createUiDomAdapter(options) {
  const { config, policy, root } = options;
  const tree = options.store ?? documentTree(config);
  const modelOptions = {
    policy,
    vocabulary: options.vocabulary ?? defaultVocabulary(),
    parentOf: (id) => tree.parentOf(id),
    getElement: (id) => tree.get(id),
  };
  const layer = policy.writeLayers.includes('session')
    ? 'session'
    : topWritableLayer(policy);
  return {
    tree: () => tree,
    nodeFor: (id) =>
      options.handle?.nodeFor?.(id) ??
      [...root.querySelectorAll('[data-link-id]')].find(
        (node) => node.getAttribute('data-link-id') === id
      ) ??
      null,
    idFor(node) {
      for (let at = node; at && root.contains(at); at = at.parentNode) {
        if (at.nodeType === 1 && at.hasAttribute('data-link-id')) {
          return at.getAttribute('data-link-id');
        }
      }
      return null;
    },
    rows: (id) =>
      tree.get(id) ? propertyRows(tree.get(id), config, modelOptions) : [],
    applyProperty(id, row, value) {
      if (typeof row === 'string') {
        row = { name: row, key: null };
      }
      return applyEdit(
        config,
        { id, name: row.name, key: row.key ?? null, value, layer },
        modelOptions
      );
    },
    observe: (callback) => config.subscribe(callback),
  };
}
