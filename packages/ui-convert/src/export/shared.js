import { componentVocabulary } from '../mappings/index.js';
import { formatLinks } from '@link-foundation/ui-core';

export const prop = (node, name) =>
  node.properties.find((p) => p.name === name)?.values[0];
export const textOf = (node) =>
  String(
    prop(node, 'label') ?? prop(node, 'value') ?? node.positional[0] ?? ''
  );
export const quote = (value) =>
  JSON.stringify(String(value)).replaceAll('<', '\\u003c');
export const commentText = (value) =>
  String(value)
    .replaceAll('*/', '* /')
    .replaceAll('--', '- -')
    .replaceAll(/[\r\n\u2028\u2029]/g, ' ');
export const templateString = (text) =>
  `\`${text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${').replaceAll('<', '\\x3c')}\``;
export const stubs = (actions) =>
  [...new Set(actions.map((a) => a.name))]
    .map((name) => `[${quote(name)}]: () => {}`)
    .join(',\n');

/** Diagnostics and printable comments are produced together. */
export function context(target, diagnostics) {
  return {
    target,
    unsupported(node, detail) {
      const message = `Unsupported ${detail} on ${node.id ?? '(anonymous)'} for ${target}`;
      diagnostics.push({
        code: 'unsupported',
        severity: 'warning',
        id: node.id ?? null,
        target,
        message,
      });
      return commentText(message);
    },
    check(node, supported) {
      return [
        ...node.properties
          .filter((p) => !supported.includes(p.name))
          .map((p) => `property ${p.name}`),
        ...(node.unknown ?? []).map(
          (value) => `link ${formatLinks([value]).trim()}`
        ),
      ].map((detail) => this.unsupported(node, detail));
    },
  };
}

export const tokenPath = (value) =>
  Array.isArray(value) && value[0] === 'token'
    ? value.slice(1).join('.')
    : null;

/** Names match ui-tokens' Swift/Kotlin exporters (Tokens is their default namespace). */
export function tokenIdentifier(path, target) {
  const words = path.split(/[.\-_\s]+/u).filter(Boolean);
  let name = words
    .map((word, i) =>
      i === 0 && target === 'swiftui'
        ? word[0].toLowerCase() + word.slice(1)
        : word[0].toUpperCase() + word.slice(1)
    )
    .join('');
  if (/^[0-9]/u.test(name)) {
    name = `_${name}`;
  }
  return `Tokens.${name}`;
}

/** Wrappers preserve runtime-supported data, and flag unknown extensions. */
export function wrapperComments({ tree, ctx }) {
  const vocabulary = componentVocabulary();
  const notes = [];
  const visit = (node) => {
    const spec = vocabulary.kinds.get(node.kind);
    if (!spec) {
      notes.push(ctx.unsupported(node, `kind ${node.kind}`));
    }
    notes.push(...ctx.check(node, [...(spec?.properties.keys() ?? [])]));
    node.children.forEach(visit);
  };
  tree.roots.forEach(visit);
  return notes.map((note) => `/* ${note} */`).join('\n');
}
