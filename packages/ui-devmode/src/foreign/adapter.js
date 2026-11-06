import { observeDom, restoreOverrides, treeView } from './runtime.js';
import { baseDocument, foreignRows, updateOriginals } from './properties.js';
import { createConfig } from '@link-foundation/ui-config';
import { importDom as defaultImportDom } from '@link-foundation/ui-convert/browser';
import { exportOverrides } from '../export.js';
import { DevModeError } from '../model.js';
import {
  applyProperty,
  checkProperty,
  readProperty,
  restoreProperty,
} from './apply.js';

/** The shared inspector adapter. It never writes mapping attributes to the page. */
export function createForeignAdapter({
  root = globalThis.document.body,
  importDom = defaultImportDom,
  ignore = () => false,
  delay = 200,
} = {}) {
  const listeners = new Set();
  const originals = new Map();
  let imported;
  let reverse;
  let config;
  let syncing = false;
  const notify = () => listeners.forEach((callback) => callback());
  const nameOf = (op) =>
    op.key === null || op.key === undefined ? op.name : `${op.name} ${op.key}`;
  const allOps = () =>
    ['user', 'session'].flatMap((layer) => config?.overrides(layer) ?? []);
  const keyOf = (id, name) => JSON.stringify([id, name]);
  const remember = (id, name, node) => {
    const key = keyOf(id, name);
    if (!originals.has(key)) {
      originals.set(key, {
        id,
        name,
        node,
        value: readProperty(node, name),
        priority: name.startsWith('style ')
          ? node.style.getPropertyPriority(name.slice(6))
          : '',
      });
    }
  };
  const reconcile = () => {
    if (syncing) {
      return;
    }
    const effective = new Map(
      allOps().map((op) => [keyOf(op.id, nameOf(op)), op])
    );
    for (const [key, original] of originals) {
      const node = imported.nodeMap.get(original.id);
      if (!node) {
        continue;
      }
      const op = effective.get(key);
      try {
        if (op) {
          checkProperty(node, original.name, op.values[0]);
          if (readProperty(node, original.name) !== op.values[0]) {
            applyProperty(node, original.name, op.values[0]);
          }
        } else if (
          node === original.node &&
          readProperty(node, original.name) !== original.value
        ) {
          restoreProperty(
            node,
            original.name,
            original.value,
            original.priority
          );
        }
      } catch {
        /* The page may have replaced a leaf with a container. */
      }
    }
    notify();
  };
  const refresh = () => {
    const saved = ['user', 'session'].map((layer) => [
      layer,
      config?.overrides(layer) ?? [],
    ]);
    imported = importDom(root, { ignore });
    updateOriginals(originals, imported.nodeMap);
    reverse = new WeakMap(
      [...imported.nodeMap].map(([id, node]) => [node, id])
    );
    config = createConfig({
      document: { roots: baseDocument(imported.nodeMap, originals) },
      keyedProps: ['attr', 'style'],
    });
    syncing = true;
    for (const [layer, ops] of saved) {
      for (const op of ops) {
        if (imported.nodeMap.has(op.id)) {
          config.set(layer, op.id, op.name, op.values, op.key ?? undefined);
        }
      }
    }
    syncing = false;
    config.subscribe(reconcile);
    reconcile();
  };
  refresh();
  // A stable proxy keeps the inspector subscribed while the live tree changes.
  const configuration = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'subscribe'
          ? (callback) => {
              listeners.add(callback);
              return () => listeners.delete(callback);
            }
          : config[key],
    }
  );
  const tree = treeView(() => imported.tree, configuration.subscribe);
  const adapter = {
    config: configuration,
    tree: () => tree,
    nodeFor: (id) => imported.nodeMap.get(id) ?? null,
    idFor(node) {
      for (let at = node; at && root.contains(at); at = at.parentNode) {
        const id = reverse.get(at);
        if (id) {
          return id;
        }
      }
      return null;
    },
    applyProperty(id, name, value) {
      name = typeof name === 'object' ? (name.label ?? nameOf(name)) : name;
      const node = adapter.nodeFor(id);
      checkProperty(node, name, value);
      remember(id, name, node);
      const [kind, key] = name.split(' ');
      applyProperty(node, name, value);
      config.set('session', id, kind, [value], key);
      return { layer: 'session' };
    },
    rows: (id) => foreignRows(adapter, config, allOps, id),
    observe: configuration.subscribe,
    exportOverrides: () => exportOverrides(configuration),
    subtree(id) {
      const node = adapter.nodeFor(id);
      if (!node) {
        throw new DevModeError('unknown-element', 'Select an element first');
      }
      return importDom(node, { ignore }).text;
    },
    restore: (text) => restoreOverrides(adapter, text),
    refresh,
    destroy() {
      observer();
      listeners.clear();
    },
  };
  const observer = observeDom(root, ignore, refresh, delay);
  return adapter;
}
