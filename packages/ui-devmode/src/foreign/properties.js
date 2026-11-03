import { formatValues } from '../model.js';
import { checkProperty, readProperty } from './apply.js';
const nameOf = (op) =>
  op.key === null || op.key === undefined ? op.name : `${op.name} ${op.key}`;

export function updateOriginals(originals, nodeMap) {
  for (const original of originals.values()) {
    const node = nodeMap.get(original.id);
    if (node && node !== original.node) {
      original.node = node;
      original.value = readProperty(node, original.name);
      original.priority = original.name.startsWith('style ')
        ? node.style.getPropertyPriority(original.name.slice(6))
        : '';
    }
  }
}
export function baseDocument(nodeMap, originals) {
  return [...nodeMap].map(([id, node]) => {
    const properties = [];
    const added = new Set();
    const add = (label, value) => {
      if (added.has(label)) {
        return;
      }
      added.add(label);
      const original = originals.get(JSON.stringify([id, label]));
      value = original ? original.value : value;
      if (value === null || value === undefined) {
        return;
      }
      const [name, key] = label.split(' ');
      properties.push({ name, values: key ? [key, value] : [value] });
    };
    if (node.nodeType === 3 || (node.nodeType === 1 && !node.children.length)) {
      add('text', node.textContent);
    }
    if (node.nodeType === 1) {
      for (const attr of node.attributes) {
        if (attr.name !== 'style') {
          add(`attr ${attr.name}`, attr.value);
        }
      }
      for (let i = 0; i < node.style.length; i++) {
        const name = node.style.item(i);
        add(`style ${name}`, node.style.getPropertyValue(name));
      }
      for (const original of originals.values()) {
        if (original.id === id) {
          add(original.name, original.value);
        }
      }
    }
    return {
      id,
      kind: 'foreign-node',
      positional: [],
      properties,
      children: [],
      unknown: [],
    };
  });
}
export function foreignRows(adapter, config, allOps, id) {
  const node = adapter.nodeFor(id);
  if (!node) {
    return [];
  }
  const names = new Set();
  if (
    node.nodeType === 3 ||
    (node.nodeType === 1 &&
      !node.children.length &&
      !['script', 'style'].includes(node.localName))
  ) {
    names.add('text');
  }
  if (node.nodeType === 1) {
    for (const attr of node.attributes) {
      if (attr.name !== 'style') {
        names.add(`attr ${attr.name}`);
      }
    }
    for (const prop of Array.from({ length: node.style.length }, (_, i) =>
      node.style.item(i)
    )) {
      names.add(`style ${prop}`);
    }
    names.add('attr title');
    names.add('style color');
    for (const op of allOps().filter((op) => op.id === id)) {
      names.add(nameOf(op));
    }
  }
  return [...names].flatMap((label) => {
    const value = readProperty(node, label) ?? '';
    try {
      checkProperty(node, label, value);
    } catch {
      return [];
    }
    const [name, key = null] = label.split(' ');
    const changed = [...allOps()]
      .reverse()
      .find((op) => op.id === id && nameOf(op) === label);
    return [
      {
        name,
        key,
        label,
        type: 'string',
        editor: 'string',
        value: [value],
        text: formatValues([value]),
        layer: changed
          ? config.valueIn('session', id, name, key ?? undefined)
            ? 'session'
            : 'user'
          : 'site',
        changed: Boolean(changed),
        locked: false,
        writable: true,
      },
    ];
  });
}
