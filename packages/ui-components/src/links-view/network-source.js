import { parse } from '@link-foundation/ui-core';
import { networkVocabulary } from './network-vocabulary.js';
import { rawSublinks } from './model.js';

const property = (node, name) =>
  node.properties?.filter((p) => p.name === name).at(-1)?.values?.[0];

/** ui-store keeps link endpoints as properties or the first two positional atoms. */
export function storeNetworkLink(store, id) {
  const node = store.get(id);
  if (!node || node.kind !== 'link') {
    return null;
  }
  return {
    id,
    source: property(node, 'source') ?? node.positional[0] ?? 0,
    target: property(node, 'target') ?? node.positional[1] ?? 0,
    label: property(node, 'label') ?? id,
  };
}

export function storeNetworkLinks(store) {
  const result = [];
  const pending = [...store.roots()];
  while (pending.length) {
    const id = pending.pop();
    const link = storeNetworkLink(store, id);
    if (link) {
      result.push(link);
    }
    pending.push(...store.children(id));
  }
  return result.reverse();
}

/** Read component configuration using the official ui-core/LiNo projection. */
export function readNetworkSource(text) {
  const parsed = parse(text, {
    checks: false,
    vocabulary: networkVocabulary(),
  });
  const root = parsed.roots.find((node) => node.kind === 'links-network');
  return {
    ...readNetworkRaw(root ? networkRaw(root, root.children) : []),
    diagnostics: parsed.diagnostics,
  };
}

export function networkRaw(element, children = []) {
  return [
    ...(element.properties ?? []).map((p) => [p.name, ...p.values]),
    ...rawSublinks(element, children),
  ];
}

export function readNetworkRaw(raw) {
  const fields = new Map(
    raw.filter(Array.isArray).map((value) => [value[0], value.slice(1)])
  );
  const links = (fields.get('items') ?? [])
    .filter(Array.isArray)
    .map((value) => {
      const props = new Map(
        value.filter(Array.isArray).map((p) => [p[0], p[1]])
      );
      return {
        id: props.get('id') ?? value[0],
        source: props.get('source') ?? value[1] ?? 0,
        target: props.get('target') ?? value[2] ?? 0,
        label: props.get('label') ?? props.get('id') ?? value[0],
      };
    });
  const labels = new Map(
    (fields.get('labels') ?? []).filter(Array.isArray).map((p) => [p[0], p[1]])
  );
  return {
    links,
    layout: fields.get('layout')?.[0] ?? 'circle',
    style: fields.get('style')?.[0] ?? 'glyph',
    minZoom: Number(labels.get('min-zoom') ?? 0.6),
  };
}
