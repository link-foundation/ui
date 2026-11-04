/** Parse with ui-core's official links-notation parser and dialect validator. */
import { parse, walk } from '@link-foundation/ui-core';
import { siteVocabulary } from '../kinds.js';
import { MAX_INPUT_SIZE } from './share.js';

export function safeUrl(value) {
  if (
    typeof value !== 'string' ||
    [...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127) ||
    value.includes('\\')
  ) {
    return false;
  }
  try {
    const url = new globalThis.URL(value, 'https://playground.invalid/');
    return url.protocol === 'https:' && !value.startsWith('//');
  } catch {
    return false;
  }
}

export function validateDocument(text, { kinds } = {}) {
  const vocabulary = siteVocabulary();
  const allowed = new Set(kinds ?? vocabulary.kinds.keys());
  const tree = parse(text, {
    vocabulary,
    maxInputSize: MAX_INPUT_SIZE,
    maxDepth: 32,
  });
  const errors = tree.diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => ({ ...d, line: d.at?.line ?? 1, column: d.at?.column ?? 1 }));
  const reject = (message) => errors.push({ message, line: 1, column: 1 });
  if (tree.unknown.length) {
    reject('Unknown document kind');
  }
  walk(tree, (node) => {
    if (!allowed.has(node.kind) || node.unknown.length) {
      reject(`Unknown kind or field on ${node.id ?? node.kind}`);
    }
    const spec = vocabulary.kinds.get(node.kind);
    node.positional.forEach((value, index) => {
      const type = spec?.properties.get(spec.positional[index])?.type;
      if (type === 'url' && !safeUrl(value)) {
        reject('Unsafe positional URL');
      }
    });
    for (const property of node.properties) {
      const type = vocabulary.kinds
        .get(node.kind)
        ?.properties.get(property.name)?.type;
      if (
        ['href', 'src', 'url'].includes(property.name) ||
        ['url', 'element-ref-or-url'].includes(type)
      ) {
        if (!property.values.every(safeUrl)) {
          reject(`Unsafe URL in ${property.name}`);
        }
      }
      if (property.name === 'on' || type === 'action') {
        property.values = [
          property.values[0],
          ['log', 'Action disabled in playground'],
        ];
      }
    }
    node.properties = node.properties.filter(
      (p) => !['bind', 'machine'].includes(p.name)
    );
  });
  return { tree, errors };
}
