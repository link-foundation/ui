/**
 * `localizeDocument`: a copy of a ui-core document with every message
 * replaced by its text and the root marked with `(lang ...)` and `(dir ...)`.
 */

import { MESSAGE_HEAD, isMessageLink } from './message.js';

/**
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 */

/** Replace every `(t ...)` link inside a raw value by its text. */
function localizeValue(raw, localizer) {
  if (isMessageLink(raw)) {
    return localizer.text(raw);
  }
  if (Array.isArray(raw)) {
    return raw.map((value) => localizeValue(value, localizer));
  }
  if (raw !== null && typeof raw === 'object' && Array.isArray(raw.values)) {
    return {
      ...raw,
      values: raw.values.map((value) => localizeValue(value, localizer)),
    };
  }
  return raw;
}

const ROOT_MARKS = ['lang', 'dir'];

function localizeNode(node, localizer, marks) {
  const isRoot = marks(node);
  /** The message that stands for the first positional value. */
  let positional = null;
  const properties = [];
  for (const property of node.properties) {
    if (property.name === MESSAGE_HEAD) {
      positional = localizer.text([MESSAGE_HEAD, ...property.values]);
    } else if (!(isRoot && ROOT_MARKS.includes(property.name))) {
      properties.push({
        ...property,
        values: property.values.map((v) => localizeValue(v, localizer)),
      });
    }
  }
  const unknown = [];
  for (const raw of node.unknown) {
    if (isMessageLink(raw)) {
      positional = localizer.text(raw);
    } else if (!(isRoot && Array.isArray(raw) && ROOT_MARKS.includes(raw[0]))) {
      unknown.push(localizeValue(raw, localizer));
    }
  }
  if (isRoot) {
    properties.push(
      { name: 'lang', values: [localizer.locale()] },
      { name: 'dir', values: [localizer.direction()] }
    );
  }
  return {
    ...node,
    positional:
      positional === null
        ? [...node.positional]
        : [positional, ...node.positional],
    properties,
    unknown,
    children: node.children.map((child) =>
      localizeNode(child, localizer, marks)
    ),
  };
}

function indexIds(nodes, byId) {
  for (const node of nodes) {
    if (node.id !== null) {
      byId.set(node.id, node);
    }
    indexIds(node.children, byId);
  }
  return byId;
}

/**
 * @param {import('@link-foundation/ui-core').UiDocument} doc
 *   as ui-core `parse` returns it (with either vocabulary)
 * @param {{ text(value: unknown): string, locale(): string, direction(): string }} localizer
 * @param {{ root?: string|null }} [options] the id of the element to mark
 *   with `(lang ...)` and `(dir ...)` (at any depth); default every root of
 *   kind `document`
 * @returns {import('@link-foundation/ui-core').UiDocument}
 */
export function localizeDocument(doc, localizer, options = {}) {
  const root = options.root ?? null;
  const isRoot = (node) =>
    root === null ? node.kind === 'document' : node.id === root;
  const roots = doc.roots.map((node) => localizeNode(node, localizer, isRoot));
  const result = {
    ...doc,
    roots,
    unknown: (doc.unknown ?? []).map((raw) => localizeValue(raw, localizer)),
    diagnostics: (doc.diagnostics ?? []).filter(
      (d) => !(d.code === 'unknown-sublink' && d.at?.head === MESSAGE_HEAD)
    ),
  };
  if (doc.byId instanceof Map) {
    result.byId = indexIds(roots, new Map());
  }
  return result;
}
