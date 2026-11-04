/** Reconcile a valid graph snapshot using the store's public operations. */
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function updateElement(store, id, node, parentId, index) {
  let view = store.get(id);
  if (view.name !== node.id) {
    id = store.rename(id, node.id);
  }
  if (store.parentOf(id) !== parentId || store.indexOf(id) !== index) {
    store.move(id, parentId, index);
  }
  view = store.get(id);
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
    node.properties.forEach((p, i) =>
      store.apply({
        op: 'setProp',
        id,
        name: p.name,
        values: p.values,
        index: i,
      })
    );
  }
  return id;
}

function initialId(store, node, parentId, index) {
  if (node.id !== null && store.has(node.id)) {
    return node.id;
  }
  const candidate = store.children(parentId)[index];
  return node.id === null && store.get(candidate)?.name === null
    ? candidate
    : undefined;
}

export function applySnapshot(store, snapshot, handles, initial, resolve) {
  const known = new Map(
    [...handles].map(([id, address]) => [resolve(address), id])
  );
  const next = new Map();
  let at = 0;
  store.transaction(
    'Apply links',
    () => {
      const walk = (nodes, parentId) =>
        nodes.forEach((node, index) => {
          const address = snapshot.handles[at++];
          let id =
            known.get(address) ??
            (initial ? initialId(store, node, parentId, index) : undefined);
          let view = id === undefined ? undefined : store.get(id);
          // Kind and opaque fields have no setter in the store API.
          if (
            view &&
            (view.kind !== node.kind || !equal(view.unknown, node.unknown))
          ) {
            store.remove(id);
            view = undefined;
          }
          id = view
            ? updateElement(store, id, node, parentId, index)
            : store.insert(parentId, index, { ...node, children: [] });
          next.set(id, address);
          walk(node.children, id);
        });
      walk(snapshot.document.roots, null);
      // Move survivors first, then discard absent subtrees.
      const removeAbsent = (ids) =>
        ids.forEach((id) => {
          if (!next.has(id)) {
            store.remove(id);
          } else {
            removeAbsent(store.children(id));
          }
        });
      removeAbsent(store.roots());
      if (!equal(store.toDocument().unknown, snapshot.document.unknown)) {
        store.apply({
          op: 'setDocumentUnknown',
          values: snapshot.document.unknown,
        });
      }
    },
    { origin: 'links' }
  );
  return next;
}
