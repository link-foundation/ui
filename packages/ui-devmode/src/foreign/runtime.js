import { readPatch } from '@link-foundation/ui-config';

export function restoreOverrides(adapter, text) {
  const patch = readPatch(text, { keyedProps: ['attr', 'style'] });
  if (patch.diagnostics.some((d) => d.severity === 'error')) {
    throw new Error('Invalid saved overrides');
  }
  const rejected = [];
  for (const op of patch.ops) {
    try {
      if (op.op !== 'set' || op.values.length !== 1) {
        throw new Error('Expected one set value');
      }
      const name = op.key === null ? op.name : `${op.name} ${op.key}`;
      adapter.applyProperty(op.id, name, op.values[0]);
    } catch (error) {
      rejected.push({ op, message: error.message });
    }
  }
  return rejected;
}

export function treeView(document, subscribe) {
  return {
    get: (id) => document().byId.get(id),
    roots: () => document().roots.map((node) => node.id),
    children: (id) =>
      (document().byId.get(id)?.children ?? []).map((node) => node.id),
    parentOf: (id) =>
      [...document().byId.values()].find((node) =>
        node.children.some((child) => child.id === id)
      )?.id ?? null,
    toDocument: document,
    subscribe,
  };
}

export function observeDom(root, ignore, refresh, delay) {
  const window = root.ownerDocument.defaultView;
  let timer;
  const observer = new window.MutationObserver((records) => {
    if (
      !records.some(
        (record) =>
          !ignore(record.target) &&
          (record.type !== 'childList' ||
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => !ignore(node)
            ))
      )
    ) {
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, delay);
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
}
