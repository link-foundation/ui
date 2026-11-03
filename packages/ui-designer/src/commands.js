/** Visual editing commands. Nested commands join the caller's transaction. */
import { format, parseOrThrow, valueMatches } from '@link-foundation/ui-core';
import { canContain, createCatalog, designerVocabulary } from './catalog.js';
export { canContain };

export const childrenOf = (store, parentId) =>
  parentId === null ? store.roots() : store.children(parentId);
export const rawValues = (value) =>
  Array.isArray(value) ? value : [String(value)];

/** Selected roots in document order: a selected ancestor subsumes its children. */
export function selectedRoots(store, ids) {
  const selected = new Set(ids);
  const result = [];
  const visit = (id) => {
    if (selected.has(id)) {
      result.push(id);
    } else {
      store.children(id).forEach(visit);
    }
  };
  store.roots().forEach(visit);
  return result;
}

/** A full node suitable for store insertion and ui-core formatting. */
export function subtree(store, id) {
  const view = store.get(id);
  if (!view) {
    throw new Error(`Unknown element ${id}`);
  }
  return {
    id: view.name,
    kind: view.kind,
    positional: [...view.positional],
    properties: globalThis.structuredClone(view.properties),
    unknown: globalThis.structuredClone(view.unknown),
    children: store.children(id).map((child) => subtree(store, child)),
  };
}

function freshId(store, type, reserved = new Set()) {
  let n = 1;
  while (store.has(`${type}-${n}`) || reserved.has(`${type}-${n}`)) {
    n++;
  }
  const id = `${type}-${n}`;
  reserved.add(id);
  return id;
}

function checkDrop(store, parentId, type, catalog) {
  if (
    parentId !== null &&
    !canContain(catalog, store.get(parentId)?.kind, type)
  ) {
    throw new Error(
      `${store.get(parentId)?.kind ?? parentId} cannot contain ${type}`
    );
  }
}

/** Insert one catalog component. Returns the new ID in a one-element array. */
export function insertElement(
  store,
  { parentId = null, index, type, props = {}, catalog = createCatalog() }
) {
  const entry = catalog.get(type);
  if (!entry) {
    throw new Error(`Unknown component ${type}`);
  }
  checkDrop(store, parentId, type, catalog);
  return store.transaction('Insert element', () => {
    const id = store.insert(parentId, index, {
      id: freshId(store, type),
      kind: type,
    });
    for (const [name, value] of Object.entries({
      ...entry.defaults,
      ...props,
    })) {
      setProperty(store, id, name, value, catalog);
    }
    return [id];
  });
}

/** Index is the drop slot before removing selected elements from that list. */
export function moveElements(
  store,
  { ids, parentId = null, index, catalog = createCatalog() }
) {
  const roots = selectedRoots(store, ids);
  for (const id of roots) {
    checkDrop(store, parentId, store.get(id).kind, catalog);
    for (let at = parentId; at !== null; at = store.parentOf(at)) {
      if (at === id) {
        throw new Error('Cannot move an element into itself or a descendant');
      }
    }
  }
  const siblings = childrenOf(store, parentId);
  const slot = index ?? siblings.length;
  const adjusted =
    slot -
    roots.filter(
      (id) => store.parentOf(id) === parentId && store.indexOf(id) < slot
    ).length;
  return store.transaction('Move elements', () => {
    // Park at the end first so a multi-move works in either direction.
    for (const id of roots) {
      store.move(id, parentId);
    }
    roots.forEach((id, offset) => store.move(id, parentId, adjusted + offset));
    return roots;
  });
}

export function removeElements(store, ids) {
  return store.transaction('Delete elements', () => {
    const roots = selectedRoots(store, ids);
    roots.forEach((id) => store.remove(id));
    return roots;
  });
}

/** IDs within a copied fragment, including reference-typed property values, remap together. */
function cloneNodes(store, nodes, catalog) {
  const names = new Map();
  const reserved = new Set();
  const visit = (node) => {
    const old = node.id;
    node.id = freshId(store, node.kind, reserved);
    if (old) {
      names.set(old, node.id);
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  const refs = new Set(['element-ref', 'element-ref-or-url']);
  const rewrite = (node) => {
    for (const prop of node.properties) {
      const type = catalog.get(node.kind)?.properties?.get(prop.name)?.type;
      if (refs.has(type)) {
        prop.values = prop.values.map((v) => names.get(v) ?? v);
      }
    }
    node.children.forEach(rewrite);
  };
  nodes.forEach(rewrite);
  return nodes;
}

export function duplicateElements(store, ids, catalog = createCatalog()) {
  const roots = selectedRoots(store, ids);
  const nodes = cloneNodes(
    store,
    roots.map((id) => subtree(store, id)),
    catalog
  );
  return store.transaction('Duplicate elements', () =>
    roots.map((id, i) =>
      store.insert(store.parentOf(id), store.indexOf(id) + 1, nodes[i])
    )
  );
}

export function setProperty(store, id, name, value, catalog = createCatalog()) {
  const entry = catalog.get(store.get(id)?.kind);
  const values = rawValues(value);
  const view = store.get(id);
  const positional =
    name === view?.kind ||
    (entry?.positional?.includes(name) &&
      !view.properties.some((prop) => prop.name === name));
  const type = entry?.properties?.get(
    positional ? entry.positional[0] : name
  )?.type;
  if (type && values.some((v) => !valueMatches(type, v))) {
    throw new Error(`Invalid ${name}`);
  }
  return store.transaction('Set property', () => {
    if (positional) {
      store.setPositional(id, values);
    } else {
      store.setProp(id, name, values);
    }
    return [id];
  });
}

export function copyElements(store, ids) {
  return format({
    roots: selectedRoots(store, ids).map((id) => subtree(store, id)),
    unknown: [],
  });
}

export function pasteElements(
  store,
  { parentId = null, index, text, catalog = createCatalog() }
) {
  const document = parseOrThrow(text, { vocabulary: designerVocabulary() });
  if (!document.roots.length) {
    throw new Error('Clipboard has no elements');
  }
  const validate = (node, parentType) => {
    if (!catalog.has(node.kind)) {
      throw new Error(`Unknown component ${node.kind}`);
    }
    if (parentType !== null && !canContain(catalog, parentType, node.kind)) {
      throw new Error(`${parentType} cannot contain ${node.kind}`);
    }
    node.children.forEach((child) => validate(child, node.kind));
  };
  document.roots.forEach((node) =>
    validate(node, store.get(parentId)?.kind ?? null)
  );
  const nodes = cloneNodes(store, document.roots, catalog);
  return store.transaction('Paste elements', () =>
    nodes.map((node, offset) =>
      store.insert(
        parentId,
        (index ?? childrenOf(store, parentId).length - offset) + offset,
        node
      )
    )
  );
}
