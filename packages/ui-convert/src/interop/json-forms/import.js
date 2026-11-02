/**
 * JSON Forms -> ui-dialect form document.
 *
 * The UI schema becomes the element tree: layouts are stacks, a Group is a
 * titled `section`, a Categorization is `tabs` of `tab` elements, a Label
 * is `text` and every Control is one form field with `(bind <path>)`. The
 * field takes its facets (type, limits, enum, format, title, ...) and its
 * required flag from the data schema property at its scope.
 *
 * Nothing is lost: what the controls do not carry of the data schema stays
 * in `(extra json-forms-schema '<json>')` on the document, and unknown
 * UI schema keys stay in `(extra json-forms '<json>')`.
 */

import { Diagnostics } from '../../diagnostics.js';
import { encodeAny, extraProperty } from '../extra.js';
import { IdAllocator, element, prop, writeLino } from '../lino.js';
import { isObject, isUnsafeKey } from '../safety.js';
import {
  FORMAT,
  JSON_FORMS_VERSION,
  SCHEMA_EXTRA,
  mapping,
  scopePath,
  scopeToBind,
} from './shared.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

/** The field kind for a data schema property. */
function fieldKind(schema) {
  if (Array.isArray(schema.enum)) {
    return 'select';
  }
  if (schema.type === 'boolean') {
    return 'checkbox';
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return 'number-field';
  }
  if (schema.format === 'date') {
    return 'date-field';
  }
  return schema.format === 'time' ? 'time-field' : 'text-field';
}

const isPlainId = (text) =>
  [...text].every(
    (c) =>
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '-' ||
      c === '_'
  );

class FormImporter {
  constructor(schema) {
    this.diagnostics = new Diagnostics(FORMAT);
    this.ids = new IdAllocator(['form']);
    /** The data schema minus what the controls carry. */
    this.residual = isObject(schema) ? clone(schema) : {};
    /** Top-level data properties with at least one control. */
    this.bound = new Set();
  }

  /**
   * The parent object schema and the property schema at a data path, in
   * the residual schema.
   * @param {string[]} path
   */
  locate(path) {
    let parent = this.residual;
    for (const [index, name] of path.entries()) {
      const properties = parent?.properties;
      if (
        isUnsafeKey(name) ||
        !isObject(properties) ||
        !Object.hasOwn(properties, name)
      ) {
        return null;
      }
      const property = properties[name];
      if (!isObject(property)) {
        return null;
      }
      if (index === path.length - 1) {
        return { parent, property, name };
      }
      parent = property;
    }
    return null;
  }

  /** Take the facets and the required flag of a property out of the residual. */
  takeFacets(path) {
    const found = path && this.locate(path);
    if (!found) {
      return { kind: 'text-field', properties: [] };
    }
    const { parent, property, name } = found;
    const kind = fieldKind(property);
    const { properties, handled } = mapping.importProperties(
      'schema',
      property
    );
    if (Array.isArray(property.enum)) {
      properties.push(
        ...property.enum.map((v) => prop('option', encodeAny(v)))
      );
      handled.add('enum');
    }
    for (const key of handled) {
      delete property[key];
    }
    if (Object.keys(property).length > 0) {
      properties.push(extraProperty(SCHEMA_EXTRA, property));
    }
    delete parent.properties[name];
    this.bound.add(path[0]);
    if (Array.isArray(parent.required) && parent.required.includes(name)) {
      parent.required = parent.required.filter((r) => r !== name);
      properties.push(prop('required', 'true'));
    }
    return { kind, properties };
  }

  node(id, kind, type, json, parts) {
    const { properties, handled } = mapping.importProperties(type, json);
    const done = new Set([...handled, ...(parts.handled ?? [])]);
    const rest = Object.fromEntries(
      Object.entries(json).filter(([key]) => !done.has(key))
    );
    return element(id, kind, {
      positional: parts.positional,
      properties: [
        ...(parts.properties ?? []),
        ...properties,
        this.rule(json.rule, id),
        extraProperty(FORMAT, rest),
      ],
      children: parts.children,
    });
  }

  item(json, path) {
    if (!isObject(json) || typeof json.type !== 'string') {
      this.diagnostics.error(
        'invalid-element',
        'A UI schema element is not an object with a string "type"; it is dropped.',
        { path }
      );
      return null;
    }
    const entry = mapping.elements.get(json.type);
    if (!entry) {
      this.diagnostics.warning(
        'unsupported-element',
        `"${json.type}" is outside the supported subset; it is kept as an opaque element.`,
        { path }
      );
      return this.node(null, 'opaque', json.type, json, {
        properties: [prop('source', FORMAT, json.type)],
        handled: ['type', 'rule'],
      });
    }
    if (json.type === 'Control') {
      return this.control(json, path);
    }
    const handled = ['type', 'rule'];
    const parts = { handled, properties: [] };
    if (json.type === 'Label' && typeof json.text === 'string') {
      parts.positional = [json.text];
      handled.push('text');
    }
    if (json.type === 'HorizontalLayout') {
      parts.properties.push(prop('direction', 'horizontal'));
    }
    if (Array.isArray(json.elements)) {
      parts.children = json.elements
        .map((e, i) => this.item(e, `${path}/elements/${i}`))
        .filter(Boolean);
      handled.push('elements');
    }
    return this.node(null, entry.kind, json.type, json, parts);
  }

  control(json, path) {
    const steps = scopePath(json.scope);
    if (typeof json.scope !== 'string') {
      this.diagnostics.warning(
        'control-without-scope',
        'A Control has no string "scope", so it has no binding.',
        { path }
      );
    } else if (json.scope.split('/').some(isUnsafeKey)) {
      this.diagnostics.warning(
        'unsafe-path',
        'A scope that names __proto__, constructor or prototype is kept as the raw scope, and its schema is not read.',
        { path: `${path}/scope` }
      );
    }
    const last = steps?.at(-1) ?? 'field';
    const id =
      (isPlainId(last) ? this.ids.claim(last) : null) ?? this.ids.fresh(last);
    const { kind, properties } = this.takeFacets(steps);
    const bind =
      typeof json.scope === 'string'
        ? prop('bind', scopeToBind(json.scope))
        : null;
    return this.node(id, kind, 'Control', json, {
      properties: [bind, ...properties],
      handled: ['type', 'rule', ...(bind ? ['scope'] : [])],
    });
  }

  /**
   * `(rule (<effect> (when (bind <path>) (equals <value>))) (target <id>))`;
   * any other rule is kept whole as `(rule (json '<json>'))` with a warning.
   */
  rule(rule, id) {
    if (rule === undefined) {
      return null;
    }
    const target = id === null ? [] : [['target', id]];
    const effect = mapping.toLino('effect', rule?.effect);
    const condition = this.condition(rule?.condition);
    const plain =
      isObject(rule) &&
      Object.keys(rule).length === 2 &&
      typeof rule.effect === 'string' &&
      effect !== rule.effect &&
      condition !== null;
    if (plain) {
      return prop('rule', [effect, condition], ...target);
    }
    this.diagnostics.warning(
      'unsupported-rule',
      'A rule is not an effect with a const or enum condition on one scope; it is kept as JSON and not evaluated.',
      { element: id ?? undefined }
    );
    return prop('rule', ['json', JSON.stringify(rule)], ...target);
  }

  condition(condition) {
    if (
      !isObject(condition) ||
      Object.keys(condition).length !== 2 ||
      typeof condition.scope !== 'string' ||
      !isObject(condition.schema) ||
      Object.keys(condition.schema).length !== 1
    ) {
      return null;
    }
    const bind = ['bind', scopeToBind(condition.scope)];
    const { schema } = condition;
    if ('const' in schema) {
      return ['when', bind, ['equals', encodeAny(schema.const)]];
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return ['when', bind, ['one-of', ...schema.enum.map(encodeAny)]];
    }
    return null;
  }
}

/** Remove `properties` and `required` left empty, deepest first. */
function pruneEmpty(schema, original) {
  if (!isObject(schema) || !isObject(original)) {
    return;
  }
  if (isObject(schema.properties)) {
    for (const [name, inner] of Object.entries(schema.properties)) {
      pruneEmpty(inner, original.properties?.[name]);
    }
    const emptied =
      Object.keys(schema.properties).length === 0 &&
      Object.keys(original.properties).length > 0;
    if (emptied) {
      delete schema.properties;
    }
  }
  if (
    Array.isArray(schema.required) &&
    schema.required.length === 0 &&
    original.required.length > 0
  ) {
    delete schema.required;
  }
}

/**
 * Import a JSON Forms form.
 * @param {{ schema?: object, uischema?: object }} form
 * @param {{ style?: 'inline'|'multiline'|'indented' }} [options]
 * @returns {{ lino: string, roots: object[],
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function importJsonForms(form, options = {}) {
  const importer = new FormImporter(form?.schema);
  if (!isObject(form) || !isObject(form.uischema)) {
    importer.diagnostics.error(
      'not-json-forms',
      'The input is not an object with a "uischema" object.',
      { path: '' }
    );
    return { lino: '', roots: [], diagnostics: importer.diagnostics.list };
  }
  const root = importer.item(form.uischema, '/uischema');
  pruneEmpty(importer.residual, form.schema);
  const rest = Object.fromEntries(
    Object.entries(form).filter(
      ([key]) => key !== 'schema' && key !== 'uischema'
    )
  );
  const unbound = Object.keys(importer.residual.properties ?? {}).filter(
    (name) => !importer.bound.has(name)
  );
  if (unbound.length > 0) {
    importer.diagnostics.info(
      'unbound-schema',
      `Data schema properties without a control are kept in extra: ${unbound.join(', ')}.`,
      { path: '/schema/properties' }
    );
  }
  const document = element('form', 'document', {
    properties: [
      prop('source', FORMAT, JSON_FORMS_VERSION),
      'schema' in form
        ? prop('extra', SCHEMA_EXTRA, JSON.stringify(importer.residual))
        : null,
      extraProperty(FORMAT, rest),
    ],
    children: root ? [root] : [],
  });
  return {
    lino: writeLino([document], options),
    roots: [document],
    diagnostics: importer.diagnostics.list,
  };
}
