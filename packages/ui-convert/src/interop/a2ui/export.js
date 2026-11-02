/**
 * ui-dialect documents -> A2UI messages.
 *
 * Each document with `(source a2ui ...)` becomes one full surface message
 * sequence: `createSurface`, one `updateComponents` with every component in
 * the pre-order of the tree, and `updateDataModel` with the whole data
 * model. `normalizeA2ui` folds any message stream into the same shape, so
 * `exportA2ui(importA2ui(x))` deep-equals `normalizeA2ui(x)`.
 */

import { Diagnostics } from '../../diagnostics.js';
import { decodeAny, readExtra } from '../extra.js';
import { allValues, readLino, value, values } from '../lino.js';
import { nesting, rebuildSlots } from './build.js';
import {
  DEFAULT_MESSAGE_VERSION,
  FORMAT,
  INPUT_TYPES,
  SLOT_KEYS,
  decodeDynamic,
  decodeOptional,
  isBindLink,
  mapping,
  readMessages,
} from './shared.js';
import { StateFolder } from './state.js';

/** The A2UI type of a `stack` element. */
function stackType(node) {
  const role = value(node, 'role');
  const roles = { list: 'List', card: 'Card', modal: 'Modal' };
  if (role in roles) {
    return roles[role];
  }
  return value(node, 'direction') === 'horizontal' ? 'Row' : 'Column';
}

/** The A2UI type of an element, or `undefined`. */
function typeOf(node) {
  if (node.kind === 'stack') {
    return stackType(node);
  }
  if (node.kind === 'opaque') {
    const source = values(node, 'source');
    return source?.[0] === FORMAT ? decodeOptional(source[1]) : undefined;
  }
  return mapping.byKind.get(node.kind)?.[0];
}

/** The A2UI action of an `(on press ...)` handler, or `undefined`. */
function action(node) {
  const handler = allValues(node, 'on').find((v) => v[0] === 'press')?.[1];
  if (!Array.isArray(handler)) {
    return undefined;
  }
  const [name, ...args] = handler;
  if (name === 'call') {
    return { functionCall: JSON.parse(String(args[0])) };
  }
  if (name !== 'emit') {
    return undefined;
  }
  const event = { name: decodeAny(args[0]) };
  if (args.length > 1) {
    event.context = JSON.parse(String(args[1]));
  }
  return { event };
}

/** The data path of a `(bind <path>)` link, or `undefined`. */
const bindPath = (raw) => (isBindLink(raw) ? raw[1] : undefined);

/** The raw A2UI id of an element. */
const rawId = (node) => decodeOptional(value(node, 'ref')) ?? node.id;

/**
 * Writes the components of a document.
 */
class SurfaceExporter {
  /** @param {Diagnostics} diagnostics */
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
    this.components = [];
  }

  /** Add an element and its subtree, in pre-order. */
  add(node) {
    const type = typeOf(node);
    if (typeof type !== 'string') {
      this.diagnostics.warning(
        'unsupported-kind',
        `A ${node.kind} element has no A2UI component; it and its children are skipped.`,
        { element: node.id ?? undefined }
      );
      return;
    }
    const json = { id: rawId(node), component: type };
    if (node.kind !== 'opaque') {
      this.special(node, type, json);
      this.slots(node, type, json);
      for (const { key, name } of mapping.propertiesOf(type)) {
        const raw = value(node, name);
        if (raw !== undefined && !(key in json)) {
          json[key] = decodeDynamic(name, raw);
        }
      }
    }
    this.components.push(Object.assign(json, readExtra(node, FORMAT)));
    node.children.forEach((child) => this.add(child));
  }

  /** The values with a type specific encoding (see build.js). */
  special(node, type, json) {
    const bind = value(node, 'bind');
    const bound = typeof bind === 'string' ? bind : undefined;
    if (type === 'Text') {
      if (node.positional.length > 0) {
        json.text = decodeAny(node.positional[0]);
      } else if (bound !== undefined) {
        json.text = { path: bound };
      }
    }
    if (type === 'Image' && value(node, 'source') !== undefined) {
      json.url = decodeDynamic('source', value(node, 'source'));
    }
    if (INPUT_TYPES.includes(type)) {
      if (bound !== undefined) {
        json.value = { path: bound };
      } else if (value(node, 'value') !== undefined) {
        json.value = decodeAny(value(node, 'value'));
      }
    }
    const handler = type === 'Button' ? action(node) : undefined;
    if (handler) {
      json.action = handler;
    }
    const options = allValues(node, 'option');
    if (type === 'ChoicePicker' && options.length > 0) {
      json.options = options.map(([v, label]) => ({
        label: decodeDynamic('option', label),
        value: decodeAny(v),
      }));
    }
  }

  /** The slots, from the nested children (unless extra keeps them raw). */
  slots(node, type, json) {
    const extra = readExtra(node, FORMAT);
    if ((SLOT_KEYS[type] ?? []).some((key) => key in extra)) {
      return;
    }
    const titles = allValues(node, 'tab').map((v) =>
      decodeDynamic('tab', v[0])
    );
    const repeat = bindPath(value(node, 'repeat'));
    Object.assign(
      json,
      rebuildSlots(type, node.children.map(rawId), { titles, repeat })
    );
  }
}

/** The messages of one surface document. */
function surfaceMessages(root, diagnostics) {
  const version = values(root, 'source')?.[1] ?? DEFAULT_MESSAGE_VERSION;
  const surfaceId = rawId(root);
  const create = { surfaceId };
  const catalog = value(root, 'catalog');
  const send = value(root, 'send-data-model');
  if (catalog !== undefined) {
    create.catalogId = decodeAny(catalog);
  }
  if (send !== undefined) {
    create.sendDataModel = decodeAny(send);
  }
  Object.assign(create, readExtra(root, FORMAT));
  const exporter = new SurfaceExporter(diagnostics);
  root.children.forEach((child) => exporter.add(child));
  const messages = [{ version, createSurface: create }];
  if (exporter.components.length > 0) {
    messages.push({
      version,
      updateComponents: { surfaceId, components: exporter.components },
    });
  }
  const model = value(root, 'model');
  if (model !== undefined) {
    messages.push({
      version,
      updateDataModel: { surfaceId, value: JSON.parse(String(model)) },
    });
  }
  return messages;
}

/**
 * Export documents as A2UI messages.
 * @param {string|{ roots: object[] }} doc LiNo text or a parsed document.
 * @param {{ id?: string }} [options] `id` picks one document; by default
 *   every document with `(source a2ui ...)` is a surface.
 * @returns {{ json: object[]|null,
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function exportA2ui(doc, options = {}) {
  const diagnostics = new Diagnostics(FORMAT);
  const { roots } = readLino(doc);
  const surfaces = roots.filter((root) =>
    options.id
      ? root.id === options.id
      : root.kind === 'document' && values(root, 'source')?.[0] === FORMAT
  );
  if (surfaces.length === 0) {
    diagnostics.error(
      'no-document',
      'The input has no A2UI document to export.',
      {}
    );
    return { json: null, diagnostics: diagnostics.list };
  }
  const json = surfaces.flatMap((root) => surfaceMessages(root, diagnostics));
  return { json, diagnostics: diagnostics.list };
}

/**
 * Fold an A2UI message stream into the shape `exportA2ui` writes: per open
 * surface a `createSurface`, one `updateComponents` with the components in
 * tree order and one `updateDataModel` with the final data model.
 * @param {object[]|{ messages: object[] }|string} messages
 * @returns {object[]}
 */
export function normalizeA2ui(messages) {
  const folder = new StateFolder(new Diagnostics(FORMAT));
  (readMessages(messages) ?? []).forEach((message, i) =>
    folder.fold(message, `/${i}`)
  );
  return [...folder.state.surfaces.values()].flatMap((surface) => {
    const version = surface.version ?? DEFAULT_MESSAGE_VERSION;
    const surfaceId = surface.id;
    const out = [{ version, createSurface: surface.create }];
    const { order } = nesting(surface);
    if (order.length > 0) {
      const components = order.map((id) => surface.components.get(id));
      out.push({ version, updateComponents: { surfaceId, components } });
    }
    if (surface.model !== undefined) {
      out.push({
        version,
        updateDataModel: { surfaceId, value: surface.model },
      });
    }
    return out;
  });
}
