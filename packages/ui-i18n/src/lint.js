/**
 * `checkHardcodedText`: in a document whose root says `(i18n required)`,
 * report literal text where a message `(t ...)` belongs. The document is
 * read with ui-core `parse` (the official links-notation parser).
 */

import { parse } from '@link-foundation/ui-core';
import { MESSAGE_HEAD } from './message.js';
import { propAtom } from './props.js';
import { i18nVocabulary } from './vocabulary.js';

/** Props whose literal values are user-visible text. */
export const DEFAULT_TEXT_PROPS = Object.freeze([
  'label',
  'title',
  'placeholder',
  'description',
]);

/** Kinds whose positional values are user-visible text. */
export const DEFAULT_TEXT_KINDS = Object.freeze({ text: true });

/** The diagnostic code of literal text. */
export const HARDCODED_TEXT = 'hardcoded-text';

/** Literal text has a letter; numbers and symbols are not language. */
const hasLetter = (value) => /\p{L}/u.test(value);

/** Whether a document root asks for messages: `(i18n required)`. */
export const requiresI18n = (root) => propAtom(root, 'i18n') === 'required';

function report(diagnostics, element, where, value) {
  diagnostics.push({
    code: HARDCODED_TEXT,
    severity: 'error',
    message: `element "${element ?? '(anonymous)'}" has the literal text '${value}' in ${where}; use (t KEY) and a catalog message`,
    at: { element, ...(where === 'positional' ? {} : { property: where }) },
    value,
  });
}

function checkNode(node, context, diagnostics) {
  const kind = context.vocabulary.kinds.get(node.kind);
  const textKind = context.kinds[node.kind] === true;
  node.positional.forEach((value, i) => {
    const property = kind?.positional[i];
    const isText = textKind || context.textProps.has(property);
    if (isText && typeof value === 'string' && hasLetter(value)) {
      report(diagnostics, node.id, property ?? 'positional', value);
    }
  });
  // Known props, then sublinks the vocabulary does not know (an unknown kind,
  // or a text prop that kind does not declare): both are on screen.
  const links = [
    ...node.properties.map((p) => [p.name, ...p.values]),
    ...node.unknown.filter((raw) => Array.isArray(raw)),
  ];
  for (const [name, ...values] of links) {
    if (name === MESSAGE_HEAD || !context.textProps.has(name)) {
      continue;
    }
    for (const value of values) {
      if (typeof value === 'string' && hasLetter(value)) {
        report(diagnostics, node.id, name, value);
      }
    }
  }
  for (const child of node.children) {
    checkNode(child, context, diagnostics);
  }
}

/**
 * @param {string} docText a UI document in Links Notation
 * @param {{
 *   textProps?: readonly string[],
 *   kinds?: Record<string, boolean>,
 *   vocabulary?: import('@link-foundation/ui-core').Vocabulary,
 * }} [options]
 * @returns {import('@link-foundation/ui-core').Diagnostic[]} one
 *   `hardcoded-text` error per literal; parse errors of a document that
 *   requires i18n are passed through. Empty when no root has
 *   `(i18n required)`.
 */
export function checkHardcodedText(docText, options = {}) {
  const vocabulary = options.vocabulary ?? i18nVocabulary();
  const doc = parse(docText, { vocabulary });
  const roots = doc.roots.filter(requiresI18n);
  if (roots.length === 0) {
    return [];
  }
  const context = {
    vocabulary,
    textProps: new Set(options.textProps ?? DEFAULT_TEXT_PROPS),
    kinds: options.kinds ?? DEFAULT_TEXT_KINDS,
  };
  const diagnostics = doc.diagnostics.filter((d) => d.severity === 'error');
  for (const root of roots) {
    checkNode(root, context, diagnostics);
  }
  return diagnostics;
}
