/**
 * ui-dialect form document -> JSON Forms `{ schema, uischema }`.
 *
 * The inverse of import.js. The data schema starts from the document's
 * `(extra json-forms-schema '<json>')`; every field puts its facets and its
 * required flag back at the path of its `(bind ...)`.
 */

import { Diagnostics } from '../../diagnostics.js';
import { decodeAny, readExtra } from '../extra.js';
import { allValues, readLino, value, values } from '../lino.js';
import { isObject } from '../safety.js';
import { FIELD_KINDS } from '../vocabulary.js';
import {
  FORMAT,
  SCHEMA_EXTRA,
  bindToScope,
  mapping,
  scopePath,
} from './shared.js';

const KIND_TYPES = {
  section: 'Group',
  tabs: 'Categorization',
  tab: 'Category',
  text: 'Label',
};

/** The single JSON value of an `(extra <name> '<json>')` property. */
function extraValue(node, name) {
  const found = node.properties.find(
    (p) => p.name === 'extra' && p.values[0] === name
  );
  return found ? JSON.parse(String(found.values[1])) : undefined;
}

class FormExporter {
  constructor(schema) {
    this.diagnostics = new Diagnostics(FORMAT);
    this.schema = schema;
  }

  json(type, node, own) {
    const mapped = mapping.exportProperties(type, (name) => value(node, name));
    const rule = this.rule(node);
    return {
      type,
      ...own,
      ...mapped,
      ...(rule === undefined ? {} : { rule }),
      ...readExtra(node, FORMAT),
    };
  }

  typeOf(node) {
    if (node.kind === 'stack') {
      return value(node, 'direction') === 'horizontal'
        ? 'HorizontalLayout'
        : 'VerticalLayout';
    }
    if (FIELD_KINDS.includes(node.kind)) {
      return 'Control';
    }
    return KIND_TYPES[node.kind];
  }

  item(node) {
    if (node.kind === 'opaque') {
      return this.json(values(node, 'source')?.[1], node, {});
    }
    const type = this.typeOf(node);
    if (!type) {
      this.diagnostics.warning(
        'unsupported-kind',
        `Kind "${node.kind}" has no JSON Forms UI schema element; it is dropped.`,
        { element: node.id ?? undefined }
      );
      return null;
    }
    if (type === 'Control') {
      return this.control(node);
    }
    const own = {};
    if (type === 'Label' && node.positional.length > 0) {
      own.text = node.positional[0];
    }
    if (mapping.inGroup('layout', type) || node.children.length > 0) {
      own.elements = node.children.map((c) => this.item(c)).filter(Boolean);
    }
    return this.json(type, node, own);
  }

  control(node) {
    const bind = value(node, 'bind');
    const own = {};
    if (typeof bind === 'string') {
      own.scope = bindToScope(bind);
      this.facets(node, scopePath(own.scope));
    } else {
      this.diagnostics.warning(
        'field-without-bind',
        'A field has no (bind ...), so its Control has no scope.',
        { element: node.id ?? undefined }
      );
    }
    return this.json('Control', node, own);
  }

  /** Put the facets of a field at its data path in the schema. */
  facets(node, path) {
    const property = {
      ...mapping.exportProperties('schema', (name) => value(node, name)),
    };
    const options = allValues(node, 'option');
    if (options.length > 0) {
      property.enum = options.map((o) => decodeAny(o[0]));
    }
    Object.assign(property, readExtra(node, SCHEMA_EXTRA));
    const required = value(node, 'required') === 'true';
    if (!path) {
      if (Object.keys(property).length > 0 || required) {
        this.diagnostics.warning(
          'facets-without-path',
          'The binding is not a plain data path, so its schema facets are dropped.',
          { element: node.id ?? undefined }
        );
      }
      return;
    }
    let parent = this.schema;
    for (const name of path.slice(0, -1)) {
      parent.properties ??= {};
      parent.properties[name] ??= { type: 'object' };
      parent = parent.properties[name];
    }
    const name = path.at(-1);
    parent.properties ??= {};
    parent.properties[name] = { ...parent.properties[name], ...property };
    if (required) {
      parent.required ??= [];
      if (!parent.required.includes(name)) {
        parent.required.push(name);
      }
    }
  }

  /** The JSON rule of `(rule ...)`, or `undefined`. */
  rule(node) {
    const raw = values(node, 'rule');
    const head = raw?.[0];
    if (!Array.isArray(head)) {
      return undefined;
    }
    if (head[0] === 'json') {
      return JSON.parse(String(head[1]));
    }
    const [effect, when] = head;
    const [, bind, test] = Array.isArray(when) ? when : [];
    const scope = Array.isArray(bind) ? bindToScope(String(bind[1])) : null;
    const condition = Array.isArray(test) ? this.condition(test) : null;
    if (!scope || !condition) {
      this.diagnostics.warning(
        'unsupported-rule',
        'A rule is not (<effect> (when (bind <path>) (equals|one-of ...))); it is dropped.',
        { element: node.id ?? undefined }
      );
      return undefined;
    }
    return {
      effect: mapping.toJson('effect', effect),
      condition: { scope, schema: condition },
    };
  }

  condition([test, ...args]) {
    if (test === 'equals' && args.length === 1) {
      return { const: decodeAny(args[0]) };
    }
    if (test === 'one-of' && args.length > 0) {
      return { enum: args.map(decodeAny) };
    }
    return null;
  }
}

/**
 * Export a form document as JSON Forms.
 * @param {string|{ roots: object[] }} doc LiNo text or a parsed document.
 * @param {{ id?: string }} [options] `id` picks the document (the first
 *   `document` by default).
 * @returns {{ json: { schema?: object, uischema: object }|null,
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function exportJsonForms(doc, options = {}) {
  const { roots } = readLino(doc);
  const root = roots.find((r) =>
    options.id ? r.id === options.id : r.kind === 'document'
  );
  const residual = root ? extraValue(root, SCHEMA_EXTRA) : undefined;
  const exporter = new FormExporter(isObject(residual) ? residual : {});
  if (!root) {
    exporter.diagnostics.error(
      'no-document',
      'The input has no document to export.',
      {}
    );
    return { json: null, diagnostics: exporter.diagnostics.list };
  }
  const elements = root.children.map((c) => exporter.item(c)).filter(Boolean);
  if (elements.length > 1) {
    exporter.diagnostics.info(
      'wrapped-root',
      'The document has several top elements; they are wrapped in a VerticalLayout.',
      { element: root.id ?? undefined }
    );
  }
  const uischema =
    elements.length === 1 ? elements[0] : { type: 'VerticalLayout', elements };
  const json = { ...readExtra(root, FORMAT) };
  if (residual !== undefined || Object.keys(exporter.schema).length > 0) {
    json.schema = exporter.schema;
  }
  json.uischema = uischema;
  return { json, diagnostics: exporter.diagnostics.list };
}

/**
 * Sort the `required` arrays of a JSON Forms data schema, the one thing a
 * round trip may reorder.
 * @template T
 * @param {T} form
 * @returns {T}
 */
export function normalizeJsonForms(form) {
  const visit = (node) => {
    if (Array.isArray(node)) {
      return node.map(visit);
    }
    if (!isObject(node)) {
      return node;
    }
    return Object.fromEntries(
      Object.entries(node).map(([key, inner]) => [
        key,
        key === 'required' && Array.isArray(inner)
          ? [...inner].sort()
          : visit(inner),
      ])
    );
  };
  return visit(form);
}
