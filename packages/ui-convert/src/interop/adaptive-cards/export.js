/**
 * ui-dialect document -> Adaptive Card.
 *
 * The inverse of import.js. With `targetVersion` older than the card,
 * elements newer than the target are replaced by their `fallback` element
 * or dropped (the card keeps its `fallbackText`), and properties newer than
 * the target are dropped; every such step adds a diagnostic.
 */

import { Diagnostics } from '../../diagnostics.js';
import { decodeAny, readExtra } from '../extra.js';
import { allValues, readLino, value, values } from '../lino.js';
import { isObject } from '../safety.js';
import { FORMAT, compareVersions, mapping } from './shared.js';

const ROLE_TYPES = {
  container: 'Container',
  'column-set': 'ColumnSet',
  column: 'Column',
  'action-set': 'ActionSet',
};

const HANDLER_TYPES = {
  submit: 'Action.Submit',
  execute: 'Action.Execute',
  'open-url': 'Action.OpenUrl',
  'show-card': 'Action.ShowCard',
  'toggle-visibility': 'Action.ToggleVisibility',
};

/** The `(on press (<action> ...))` link of a button, as an array. */
const pressAction = (node) =>
  allValues(node, 'on').find((v) => v[0] === 'press')?.[1];

class CardExporter {
  constructor(roots) {
    this.diagnostics = new Diagnostics(FORMAT);
    this.byId = new Map(roots.filter((r) => r.id).map((r) => [r.id, r]));
    this.visiting = new Set();
  }

  /** Mapped properties, then the type-specific keys, then `extra`. */
  json(type, node, own) {
    const mapped = mapping.exportProperties(type, (name) => value(node, name));
    return { type, ...mapped, ...own, ...readExtra(node, FORMAT) };
  }

  card(node) {
    this.visiting.add(node.id);
    const own = {};
    const source = values(node, 'source');
    if (source?.[0] === FORMAT && typeof source[1] === 'string') {
      own.version = source[1];
    }
    for (const child of node.children) {
      const role = value(child, 'role');
      if (child.kind === 'stack' && role === 'body') {
        own.body = this.items(child.children, (c) => this.item(c));
      } else if (child.kind === 'stack' && role === 'actions') {
        own.actions = this.items(child.children, (c) => this.action(c));
      }
    }
    this.visiting.delete(node.id);
    return this.json('AdaptiveCard', node, own);
  }

  /** An element kept whole: its type is in `(source adaptive-cards <type>)`. */
  opaque(node) {
    const type = values(node, 'source')?.[1];
    return this.json(type, node, this.withId(node, {}));
  }

  items(nodes, read) {
    return nodes.map(read).filter(Boolean);
  }

  withId(node, own) {
    return node.id === null ? own : { id: node.id, ...own };
  }

  typeOf(node) {
    if (node.kind === 'stack') {
      return ROLE_TYPES[value(node, 'role')] ?? 'Container';
    }
    const types = mapping.byKind.get(node.kind);
    return types?.[0];
  }

  item(node) {
    if (node.kind === 'opaque') {
      return this.opaque(node);
    }
    if (node.kind === 'button') {
      return this.action(node);
    }
    const type = this.typeOf(node);
    if (!type) {
      this.diagnostics.warning(
        'unsupported-kind',
        `Kind "${node.kind}" has no Adaptive Cards element; it is dropped.`,
        { element: node.id ?? undefined }
      );
      return null;
    }
    if (mapping.inGroup('input', type)) {
      return this.input(node, type);
    }
    return this.json(type, node, this.withId(node, this.itemParts(node, type)));
  }

  itemParts(node, type) {
    switch (type) {
      case 'TextBlock':
        return node.positional.length > 0 ? { text: node.positional[0] } : {};
      case 'Image':
        return node.positional.length > 0 ? { url: node.positional[0] } : {};
      case 'Container':
      case 'Column':
        return this.children(node, 'items', (c) => this.item(c));
      case 'ColumnSet':
        return this.children(node, 'columns', (c) => this.item(c));
      case 'ActionSet':
        return this.children(node, 'actions', (c) => this.action(c));
      case 'FactSet':
        return this.facts(node);
      default:
        return {};
    }
  }

  /** Children as a JSON array, written when the node has any. */
  children(node, key, read) {
    if (node.children.length === 0 && key in readExtra(node, FORMAT)) {
      return {};
    }
    return { [key]: this.items(node.children, read) };
  }

  facts(node) {
    const facts = allValues(node, 'fact');
    return facts.length === 0
      ? {}
      : { facts: facts.map(([title, val]) => ({ title, value: val })) };
  }

  input(node, type) {
    const bind = value(node, 'bind');
    const own = {};
    if (typeof bind === 'string') {
      own.id = bind;
    } else if (node.id !== null) {
      own.id = node.id;
    }
    const options = allValues(node, 'option');
    if (options.length > 0) {
      own.choices = options.map(([val, title]) => ({ title, value: val }));
    }
    return this.json(type, node, own);
  }

  action(node) {
    if (node.kind === 'opaque') {
      return this.opaque(node);
    }
    const handler = pressAction(node);
    const type = Array.isArray(handler) ? HANDLER_TYPES[handler[0]] : undefined;
    if (node.kind !== 'button' || !type) {
      this.diagnostics.warning(
        'unsupported-action',
        'Only buttons with a submit, execute, open-url, show-card or toggle-visibility handler become actions; this one is dropped.',
        { element: node.id ?? undefined }
      );
      return null;
    }
    return this.json(
      type,
      node,
      this.withId(node, this.actionParts(type, handler.slice(1)))
    );
  }

  actionParts(type, args) {
    if (type === 'Action.OpenUrl') {
      return typeof args[0] === 'string' ? { url: args[0] } : {};
    }
    if (type === 'Action.ShowCard') {
      const card = this.byId.get(args[0]);
      if (!card || this.visiting.has(card.id)) {
        return {};
      }
      return { card: this.card(card) };
    }
    if (type === 'Action.ToggleVisibility' && args.length > 0) {
      return {
        targetElements: args.map((t) =>
          typeof t === 'string'
            ? t
            : { elementId: t[0], isVisible: decodeAny(t[1]) }
        ),
      };
    }
    return {};
  }
}

/** Arrays of elements and actions inside an element, by key. */
const NESTED = ['body', 'items', 'columns', 'actions'];

/**
 * Make a card valid for an older Adaptive Cards version.
 */
class Downgrade {
  constructor(target, diagnostics) {
    this.target = target;
    this.diagnostics = diagnostics;
  }

  newer(since) {
    return since !== undefined && compareVersions(since, this.target) > 0;
  }

  /** One element: itself, its fallback, or `null` (dropped). */
  element(json, path) {
    if (!isObject(json)) {
      return json;
    }
    const since = mapping.typeSince.get(json.type);
    if (!this.newer(since)) {
      return this.properties(json, path);
    }
    if (isObject(json.fallback)) {
      this.diagnostics.warning(
        'version-fallback',
        `"${json.type}" needs Adaptive Cards ${since}; it is replaced by its fallback for ${this.target}.`,
        { path }
      );
      return this.element(json.fallback, `${path}/fallback`);
    }
    this.diagnostics.warning(
      'version-drop',
      `"${json.type}" needs Adaptive Cards ${since} and has no fallback element; it is dropped for ${this.target} (the card keeps its fallbackText).`,
      { path }
    );
    return null;
  }

  properties(json, path) {
    const out = {};
    for (const [key, val] of Object.entries(json)) {
      const since = mapping.keySince(json.type, key);
      if (this.newer(since)) {
        this.diagnostics.warning(
          'version-drop-property',
          `"${json.type}.${key}" needs Adaptive Cards ${since}; it is dropped for ${this.target}.`,
          { path: `${path}/${key}` }
        );
      } else if (NESTED.includes(key) && Array.isArray(val)) {
        out[key] = val
          .map((item, i) => this.element(item, `${path}/${key}/${i}`))
          .filter((item) => item !== null);
      } else if (key === 'card' && isObject(val)) {
        out[key] = this.properties(val, `${path}/card`);
      } else {
        out[key] = val;
      }
    }
    return out;
  }
}

/**
 * Export a document as an Adaptive Card.
 * @param {string|{ roots: object[] }} doc LiNo text or a parsed document.
 * @param {{ targetVersion?: string, id?: string }} [options]
 *   `targetVersion` defaults to the version in `(source adaptive-cards ...)`;
 *   `id` picks the document (the first `document` by default).
 * @returns {{ json: object|null,
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function exportAdaptiveCard(doc, options = {}) {
  const { roots } = readLino(doc);
  const exporter = new CardExporter(roots);
  const root = roots.find((r) =>
    options.id ? r.id === options.id : r.kind === 'document'
  );
  if (!root) {
    exporter.diagnostics.error(
      'no-document',
      'The input has no document to export.',
      {}
    );
    return { json: null, diagnostics: exporter.diagnostics.list };
  }
  let json = exporter.card(root);
  const target = options.targetVersion;
  if (target !== undefined) {
    const from = json.version;
    json = new Downgrade(target, exporter.diagnostics).properties(json, '');
    json.version = target;
    if (from !== undefined && compareVersions(from, target) < 0) {
      exporter.diagnostics.info(
        'version-upgrade',
        `The card says ${from}; it is written as ${target}.`,
        { path: '/version' }
      );
    }
  }
  return { json, diagnostics: exporter.diagnostics.list };
}
