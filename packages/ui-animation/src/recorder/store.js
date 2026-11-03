/** Adapt the merged store's committed operation log; never depend on event internals. */
import { createStore, logFromLino, logToLino } from '@link-foundation/ui-store';
import { formatLinks, parseLinks } from '@link-foundation/ui-core';

const idsOf = (store, id) => [
  id,
  ...store.children(id).flatMap((child) => idsOf(store, child)),
];
export function snapshotStore(store, mapNode = (node) => node) {
  const mapTree = (node, id) =>
    mapNode(
      {
        ...node,
        children: node.children.map((child, index) =>
          mapTree(child, store.children(id)[index])
        ),
      },
      id
    );
  const source = store.toDocument();
  const document = {
    ...source,
    roots: source.roots.map((node, index) =>
      mapTree(node, store.roots()[index])
    ),
  };
  const ops = document.roots.map((node, index) => ({
    op: 'insert',
    parentId: null,
    index,
    node,
    ids: idsOf(store, store.roots()[index]),
  }));
  return ops.length
    ? logToLino([{ tx: 1, origin: 'recording', label: null, ops }])
    : '';
}
export function restoreStore(store, snapshot = '') {
  store.transaction(
    'Replay snapshot',
    () => {
      for (const id of store.roots()) {
        store.remove(id);
      }
      for (const entry of logFromLino(snapshot)) {
        for (const op of entry.ops) {
          store.apply(op);
        }
      }
    },
    { origin: 'replay' }
  );
}
export function storeFromSnapshot(snapshot) {
  const store = createStore();
  restoreStore(store, snapshot);
  return store;
}
export function operationEvent(op, time) {
  if (op.op === 'setProp' && op.index === undefined) {
    return { time, kind: 'set', args: [op.id, op.name, ...op.values] };
  }
  const raw = parseLinks(
    logToLino([{ tx: 1, origin: 'recording', label: null, ops: [op] }])
  )[0];
  const encoded = raw.find(
    (part) => Array.isArray(part) && !['origin', 'label'].includes(part[0])
  );
  const kind = ['insert', 'remove', 'move'].includes(op.op) ? op.op : 'set';
  return {
    time,
    kind,
    args: kind === op.op ? encoded.slice(1) : [['operation', encoded]],
  };
}
export const isDiff = (event) =>
  ['set', 'insert', 'remove', 'move'].includes(event.kind);
export function applyEvent(store, event) {
  if (!isDiff(event)) {
    return;
  }
  if (event.kind === 'set' && event.args[0]?.[0] !== 'operation') {
    store.setProp(event.args[0], event.args[1], event.args.slice(2));
    return;
  }
  const op =
    event.kind === 'set' ? event.args[0][1] : [event.kind, ...event.args];
  const [entry] = logFromLino(
    formatLinks([['tx', '1', ['origin', 'replay'], op]])
  );
  store.apply(entry.ops[0]);
}
