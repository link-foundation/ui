/** Two-way source synchronization through ui-core/source (#22) and ui-store (#16). */
import { parse, formatLinks } from '@link-foundation/ui-core';
import {
  applyOpsToSource,
  indexSource,
  applyEdits,
} from '@link-foundation/ui-core/source';
import { createStore } from '@link-foundation/ui-store';
import { designerVocabulary } from './catalog.js';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const options = () => ({ vocabulary: designerVocabulary() });
export function storeIds(store) {
  const visit = (id) => [id, ...store.children(id).flatMap(visit)];
  return store.roots().flatMap(visit);
}
export const cloneStore = (store) =>
  createStore({ document: store.toDocument(), ids: storeIds(store) });

function namedPrefix(id) {
  const fragment = formatLinks([{ id, values: ['text'] }]);
  const span = indexSource(fragment).root.children[0];
  return fragment.slice(0, span.kindSpan.start);
}

/** Add source names only to anonymous nodes addressed by this canvas gesture. */
function addressAnonymous(text, ops, store) {
  if (!store) {
    return text;
  }
  const addressed = new Set(ops.flatMap((op) => [op.id, op.parentId]));
  const spans = [];
  const visit = (node) => {
    if (node.kind === 'element') {
      spans.push(node);
    }
    node.children.forEach(visit);
  };
  visit(indexSource(text, options()).root);
  const ids = storeIds(store);
  const edits = spans.flatMap((node, i) =>
    node.id === null && addressed.has(ids[i])
      ? [
          {
            start: node.kindSpan.start,
            end: node.kindSpan.start,
            insert: namedPrefix(ids[i]),
          },
        ]
      : []
  );
  return applyEdits(text, edits);
}

/** A change is one store op or an array. Throws before any store mutation. */
export function canvasToSource(sourceText, change, { store } = {}) {
  const ops = Array.isArray(change) ? change : [change];
  const text = addressAnonymous(sourceText, ops, store);
  const result = applyOpsToSource(text, ops, options());
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.text;
}

/** Parser diagnostics already carry source positions; semantic errors use their element span. */
function errorLocation(text, diagnostic) {
  let line = diagnostic.at?.line;
  let column = diagnostic.at?.column;
  if (!line) {
    try {
      const root = indexSource(text, options()).root;
      let offset = 0;
      const visit = (node) => {
        if (node.kind === 'element' && node.id === diagnostic.at?.element) {
          offset = node.start;
        }
        node.children.forEach(visit);
      };
      visit(root);
      const before = text.slice(0, offset).split('\n');
      line = before.length;
      column = before.at(-1).length + 1;
    } catch {
      line = 1;
      column = 1;
    }
  }
  return { line, column: column ?? 1, message: diagnostic.message };
}

function readDocument(text) {
  const document = parse(text, options());
  const diagnostic = document.diagnostics.find((d) => d.severity === 'error');
  return diagnostic ? { error: errorLocation(text, diagnostic) } : { document };
}

function matchId(store, node, parentId, used, named) {
  let id = node.id;
  if (!id) {
    const candidates = (
      parentId === null ? store.roots() : store.children(parentId)
    ).filter(
      (candidate) =>
        !used.has(candidate) &&
        !named.has(candidate) &&
        store.get(candidate).name === null &&
        store.get(candidate).kind === node.kind
    );
    id =
      candidates.find(
        (candidate) =>
          equal(store.get(candidate).positional, node.positional) &&
          equal(store.get(candidate).properties, node.properties)
      ) ?? candidates[0];
  }
  return id;
}

/** Reconcile names globally and anonymous nodes by equal content, then sibling kind. */
function reconcile(store, document) {
  const used = new Set();
  const retained = new Set();
  const named = new Set(document.byId.keys());
  const update = (node, parentId, index) => {
    let id = matchId(store, node, parentId, used, named);
    if (
      id &&
      store.has(id) &&
      (store.get(id).kind !== node.kind ||
        !equal(store.get(id).unknown, node.unknown))
    ) {
      // Preserve existing child identities even when their parent's kind changes.
      for (const child of store.children(id)) {
        store.move(child, null);
      }
      store.remove(id);
    }
    if (!id || !store.has(id)) {
      id = store.insert(parentId, index, {
        ...node,
        id: id ?? null,
        children: [],
      });
    } else {
      const view = store.get(id);
      if (view.parentId !== parentId || store.indexOf(id) !== index) {
        store.move(id, parentId, index);
      }
      if (!equal(view.positional, node.positional)) {
        store.setPositional(id, node.positional);
      }
      if (!equal(view.properties, node.properties)) {
        for (let i = view.properties.length - 1; i >= 0; i--) {
          store.apply({
            op: 'removeProp',
            id,
            name: view.properties[i].name,
            index: i,
          });
        }
        node.properties.forEach((prop, i) =>
          store.apply({ op: 'setProp', id, ...prop, index: i })
        );
      }
    }
    used.add(id);
    retained.add(id);
    node.children.forEach((child, i) => update(child, id, i));
  };
  document.roots.forEach((node, i) => update(node, null, i));
  // Remove obsolete nodes after moving survivors out of deleted parents.
  for (const id of storeIds(store).reverse()) {
    if (!retained.has(id)) {
      store.remove(id);
    }
  }
}

/** Parse and diff on an isolated store before applying one real transaction. */
export function sourceToStore(store, text) {
  const result = readDocument(text);
  if (result.error) {
    return result;
  }
  const preview = cloneStore(store);
  try {
    preview.transaction('Edit source', () =>
      reconcile(preview, result.document)
    );
    const ops = preview.log().at(-1)?.ops ?? [];
    store.transaction('Edit source', () =>
      ops.forEach((op) => store.apply(op))
    );
    return { ids: storeIds(store), ops };
  } catch (error) {
    return { error: { line: 1, column: 1, message: error.message } };
  }
}

/** Source snapshots accompany store transactions so undo restores exact comments and whitespace. */
export function createDocumentSession(initialText) {
  const parsed = readDocument(initialText);
  if (parsed.error) {
    throw new Error(
      `${parsed.error.line}:${parsed.error.column}: ${parsed.error.message}`
    );
  }
  const store = createStore({ document: parsed.document });
  let text = initialText;
  let pending = null;
  const snapshots = new Map();
  const listeners = new Set();
  const stop = store.subscribe((events, entry) => {
    const before = text;
    if (entry.undoes !== undefined) {
      text = snapshots.get(entry.undoes).before;
    } else if (entry.redoes !== undefined) {
      text = snapshots.get(entry.redoes).after;
    } else {
      text = pending ?? canvasToSource(text, entry.ops);
    }
    snapshots.set(entry.tx, { before, after: text });
    listeners.forEach((listener) => listener(events, entry));
  });
  function commit(ops, nextText, label) {
    pending = nextText;
    try {
      store.transaction(label, () => ops.forEach((op) => store.apply(op)));
      if (!ops.length && text !== nextText) {
        // Whitespace/comment-only source changes still need one undoable gesture.
        const id = store.roots()[0];
        if (id) {
          store.transaction(label, () =>
            store.setPositional(id, [...store.get(id).positional])
          );
        } else {
          store.transaction(label, () => {
            const temporary = store.insert(null, 0, { kind: 'text' });
            store.remove(temporary);
          });
        }
      }
    } finally {
      pending = null;
    }
  }
  return {
    store,
    getText: () => text,
    run(command, label = 'Canvas edit', validate = () => {}) {
      const preview = cloneStore(store);
      const value = preview.transaction(label, () => command(preview));
      const ops = preview.log().at(-1)?.ops ?? [];
      validate(ops);
      const nextText = canvasToSource(text, ops, { store });
      commit(ops, nextText, label);
      return value;
    },
    editSource(nextText, validate = () => {}) {
      const preview = cloneStore(store);
      const result = sourceToStore(preview, nextText);
      if (!result.error) {
        try {
          validate(result.ops);
          commit(result.ops, nextText, 'Edit source');
        } catch (error) {
          return { error: { line: 1, column: 1, message: error.message } };
        }
      }
      return result;
    },
    undo: () => store.undo(),
    redo: () => store.redo(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      stop();
      listeners.clear();
    },
  };
}
