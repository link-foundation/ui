#!/usr/bin/env node

/**
 * Non-normative reference projection for the UI dialect `ui-dialect/0`
 * (docs/spec/). It turns Links Notation text into the element tree JSON that
 * docs/spec/element-tree.schema.json describes, and reports the diagnostics
 * that docs/spec/*.md define.
 *
 * It exists only so that scripts/check-spec-fixtures.mjs can prove that every
 * expected fixture JSON follows the written rules. The production
 * implementation and the typed value reader belong to ui-core.
 *
 * Usage: node scripts/spec-reference-projection.mjs <file.lino>
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Link, Parser } from 'links-notation';

export const SPEC_VERSION = 'ui-dialect/0';
export const MAX_DEPTH = 64;
export const MAX_INPUT_SIZE = 1024 * 1024;

const DIMENSION = /^-?(\d+(\.\d+)?|\.\d+)(px|rem|em|%|vw|vh)$/;
const NUMBER = /^-?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/;
const DURATION = /^(\d+(\.\d+)?|\.\d+)(ms|s)$/;
const HEX_COLOR = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOKEN_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

const isAtom = (link) => link.values.length === 0;
const atomText = (link) => link.id;
/** A path link: no id, and its first value is a link (projection.md). */
const isPath = (link) =>
  !isAtom(link) && link.id === null && !isAtom(link.values[0]);

/**
 * The anonymous wrapper of a multi-line group, `(H (H a) (H b) ...)`: every
 * payload value is a path link with the same path H. Its head always
 * declares a new node (projection.md).
 */
function isGroupWrapper(link) {
  if (!isPath(link) || link.values.length < 2) {
    return false;
  }
  const key = link.values[0].format();
  return link.values
    .slice(1)
    .every((value) => isPath(value) && value.values[0].format() === key);
}

/** JSON form of a value: atom -> string, anonymous link -> array. */
export function valueJson(link) {
  if (isAtom(link)) {
    return atomText(link);
  }
  const values = link.values.map(valueJson);
  return link.id === null ? values : { id: link.id, values };
}

/**
 * Read docs/spec/vocabulary.lino into { kinds, actions, multi }.
 * The vocabulary is itself a ui-dialect/0 document whose elements have the
 * kind `kind` or `action`, so it is projected with a bootstrap vocabulary.
 */
export function readVocabulary(text) {
  const bootstrap = {
    kinds: new Map([
      [
        'kind',
        {
          positional: [],
          properties: new Map([
            ['description', { type: 'string' }],
            ['positional', { type: 'any' }],
            ['property', { type: 'any', multi: true }],
            ['children', { type: 'any' }],
          ]),
        },
      ],
      [
        'action',
        {
          positional: [],
          properties: new Map([
            ['description', { type: 'string' }],
            ['argument', { type: 'any', multi: true }],
          ]),
        },
      ],
      [
        'dialect',
        {
          positional: [],
          properties: new Map([
            ['version', { type: 'string' }],
            ['multi-valued', { type: 'any' }],
            ['reserved-sigil', { type: 'any' }],
            ['reserved-property', { type: 'any', multi: true }],
            ['common-property', { type: 'any', multi: true }],
          ]),
        },
      ],
    ]),
    actions: new Set(),
  };
  const { tree, diagnostics } = projectText(text, bootstrap);
  if (diagnostics.length > 0) {
    throw new Error(`vocabulary: ${JSON.stringify(diagnostics)}`);
  }
  const vocabulary = { kinds: new Map(), actions: new Map() };
  const prop = (element, name) =>
    element.properties.filter((p) => p.name === name);
  const entries = (element, name) =>
    prop(element, name).map(({ values: [property, type, ...flags] }) => [
      property,
      { type, multi: flags.includes('multi') },
    ]);
  const common = tree.elements
    .filter((element) => element.kind === 'dialect')
    .flatMap((element) => entries(element, 'common-property'));
  for (const element of tree.elements) {
    if (element.kind === 'kind') {
      // A common property (such as `note`) is declared on every kind.
      const properties = new Map([...common, ...entries(element, 'property')]);
      const [children] = prop(element, 'children').map((p) => p.values[0]);
      vocabulary.kinds.set(element.id, {
        positional: prop(element, 'positional').flatMap((p) => p.values),
        properties,
        children: children ?? 'any',
      });
    } else if (element.kind === 'action') {
      vocabulary.actions.set(
        element.id,
        prop(element, 'argument').map((p) => p.values)
      );
    }
  }
  return vocabulary;
}

/**
 * A node that collects values: a property, an unknown sublink or a link
 * nested in one of them. `local` maps the heads and paths known inside it.
 */
function valueNode(values, owner, name, unknown = false) {
  return {
    node: 'property',
    json: { name, values },
    local: new Map(),
    owner,
    unknown,
  };
}

class Projector {
  constructor(vocabulary) {
    this.vocabulary = vocabulary;
    this.diagnostics = [];
    this.ids = new Set();
    this.global = new Map();
    this.root = { elements: [], local: new Map() };
    this.rootNode = {
      node: 'element',
      json: this.rootView(),
      local: this.root.local,
    };
  }

  warn(code, at) {
    this.diagnostics.push({ code, severity: 'warning', at });
  }

  error(code, at) {
    this.diagnostics.push({ code, severity: 'error', at });
  }

  /** Create an element node from a link with an id (or an anonymous kind). */
  makeElement(link, id) {
    const values = link.values;
    const [kindLink, ...rest] = values;
    const kind = kindLink && isAtom(kindLink) ? atomText(kindLink) : null;
    const element = {
      node: 'element',
      json: {
        id,
        kind,
        positional: [],
        properties: [],
        children: [],
        unknown: [],
      },
      local: new Map(),
    };
    if (id !== null) {
      if (this.ids.has(id)) {
        this.error('duplicate-id', { element: id });
      }
      this.ids.add(id);
    }
    if (kind === null) {
      this.error('missing-kind', { element: id });
    } else if (!this.vocabulary.kinds.has(kind)) {
      this.warn('unknown-kind', { element: id, kind });
    }
    const head = new Link(id, values.filter(isAtom));
    if (id !== null) {
      this.global.set(head.format(), element);
    }
    // The head names the element inside itself too, so the path links of a
    // multi-line group, ((text A) (style x)), fold into it.
    element.local.set(link.format(), element);
    for (const value of rest) {
      this.append(element, value);
    }
    return element;
  }

  /** Append one value of the source to an element or property node. */
  append(node, value) {
    if (node.node === 'property') {
      return this.appendToProperty(node, value);
    }
    if (isPath(value)) {
      return this.fold(node, value);
    }
    const element = node.json;
    if (isAtom(value)) {
      this.checkSigil(atomText(value), element.id);
      element.positional.push(atomText(value));
      return null;
    }
    if (value.id !== null) {
      const child = this.makeElement(value, value.id);
      element.children.push(child.json);
      node.local.set(value.format(), child);
      return child;
    }
    const head = atomText(value.values[0]);
    const spec = this.vocabulary.kinds.get(element.kind);
    if (spec?.properties.has(head)) {
      return this.addProperty(node, value, head, spec.properties.get(head));
    }
    if (this.vocabulary.kinds.has(head)) {
      const child = this.makeElement(value, null);
      element.children.push(child.json);
      node.local.set(value.format(), child);
      return child;
    }
    return this.keepUnknown(node, value, head);
  }

  /**
   * Keep an unknown sublink as one value of `unknown`. It is returned as a
   * value node, so that its indented lines (path links naming it) fold into
   * it and the three forms stay equal (projection.md).
   */
  keepUnknown(node, link, head) {
    this.warn('unknown-sublink', { element: node.json.id, head });
    const json = valueJson(link);
    node.json.unknown.push(json);
    const unknown = valueNode(json, node.json, undefined, true);
    unknown.local.set(link.format(), unknown);
    node.local.set(link.format(), unknown);
    return unknown;
  }

  addProperty(node, link, name, spec) {
    const element = node.json;
    const property = valueNode([], element, name, false);
    // A multi-line property value folds back onto the property head.
    property.local.set(link.format(), property);
    if (!spec.multi) {
      const index = element.properties.findIndex((p) => p.name === name);
      if (index !== -1) {
        this.warn('duplicate-property', {
          element: element.id,
          property: name,
        });
        element.properties.splice(index, 1);
      }
    }
    element.properties.push(property.json);
    node.local.set(link.format(), property);
    for (const value of link.values.slice(1)) {
      this.appendToProperty(property, value);
    }
    return property;
  }

  /**
   * Append one value to a value node. Returns the value node of a nested
   * link, so that the lines indented under it fold into it, or null.
   */
  appendToProperty(property, value) {
    if (isPath(value)) {
      // A path inside a multi-line value, e.g. ((track a) (key 0 1)).
      const [first, ...rest] = value.values;
      const wrapper = isGroupWrapper(value);
      let target = wrapper ? null : property.local.get(first.format());
      if (wrapper) {
        target = this.appendToProperty(property, first);
      }
      if (target) {
        for (const item of rest) {
          const created = this.appendToProperty(target, item);
          if (created) {
            property.local.set(new Link(null, [first, item]).format(), created);
          }
        }
        return target;
      }
    }
    const json = valueJson(value);
    if (!property.unknown) {
      this.walkSigils(json, property.owner.id, property.json.name);
    }
    property.json.values.push(json);
    if (isAtom(value)) {
      return null;
    }
    const values = Array.isArray(json) ? json : json.values;
    const node = valueNode(values, property.owner, property.json.name);
    node.unknown = property.unknown;
    // Known in its parent and in itself, as an element head is.
    property.local.set(value.format(), node);
    node.local.set(value.format(), node);
    return node;
  }

  /**
   * Whether an unknown path may be declared in an element (projection.md):
   * an element head, a property head of its kind, or a path made of them.
   */
  declarable(context, path) {
    if (path.id !== null) {
      return true;
    }
    if (isPath(path)) {
      const key = path.values[0].format();
      return (
        context.local.has(key) ||
        this.global.has(key) ||
        this.declarable(context, path.values[0])
      );
    }
    const head = atomText(path.values[0]);
    const spec = this.vocabulary.kinds.get(context.json.kind);
    return (
      this.vocabulary.kinds.has(head) || Boolean(spec?.properties.has(head))
    );
  }

  /** Path folding: (P v1 v2 ...) where P is a head or a known path. */
  fold(context, link) {
    const [first, ...rest] = link.values;
    const key = first.format();
    const wrapper = isGroupWrapper(link);
    let target = wrapper
      ? null
      : (context.local.get(key) ?? this.global.get(key));
    if (!target) {
      if (!wrapper && !this.declarable(context, first)) {
        // Not foldable: keep the whole link verbatim, once.
        this.warn('unknown-sublink', { element: context.json.id, head: null });
        context.json.unknown.push(valueJson(link));
        return null;
      }
      target = this.append(context, first);
    }
    if (!target) {
      return null;
    }
    for (const value of rest) {
      const created = this.append(target, value);
      if (created) {
        this.global.set(new Link(null, [first, value]).format(), created);
      }
    }
    return target;
  }

  checkSigil(text, element, property) {
    if (text.startsWith('@') || text.startsWith('$')) {
      this.warn(
        'reserved-sigil',
        property ? { element, property } : { element }
      );
    }
  }

  walkSigils(json, element, property) {
    if (typeof json === 'string') {
      this.checkSigil(json, element, property);
    } else if (Array.isArray(json)) {
      json.forEach((v) => this.walkSigils(v, element, property));
    } else {
      json.values.forEach((v) => this.walkSigils(v, element, property));
    }
  }

  /** The root accepts only elements: an atom there is an unknown sublink. */
  top(link) {
    if (isAtom(link)) {
      this.warn('unknown-sublink', { element: null, head: atomText(link) });
      this.root.unknown ??= [];
      this.root.unknown.push(atomText(link));
      return;
    }
    this.append(this.rootNode, link);
  }

  /** The document root behaves as an element whose children are elements. */
  rootView() {
    const root = this.root;
    return {
      id: null,
      kind: null,
      get children() {
        return root.elements;
      },
      positional: [],
      properties: [],
      unknown: (root.unknown ??= []),
    };
  }
}

/** Value checks that need the vocabulary types (values.md, behaviour.md). */
function checkValues(tree, vocabulary, diagnostics) {
  const visit = (element) => {
    const spec = vocabulary.kinds.get(element.kind);
    for (const property of element.properties) {
      const type = spec?.properties.get(property.name)?.type;
      checkProperty(element, property, type, vocabulary, diagnostics);
    }
    if (spec && spec.children === 'none' && element.children.length > 0) {
      diagnostics.push({
        code: 'unexpected-child',
        severity: 'warning',
        at: { element: element.id },
      });
    }
    element.children.forEach(visit);
  };
  tree.elements.forEach(visit);
}

function isTypedReference(value) {
  return Array.isArray(value) && ['token', 'param', 'or'].includes(value[0]);
}

const STRING_CHECKS = {
  number: (v) => NUMBER.test(v),
  dimension: (v) => DIMENSION.test(v) || v === '0',
  duration: (v) => DURATION.test(v),
  color: (v) => HEX_COLOR.test(v),
  url: (v) => /^(https?:|mailto:|\/|\.)/.test(v) || !v.includes(':'),
  'token-name': (v) => TOKEN_NAME.test(v),
};

function isFunctionalColor(value) {
  const [space, ...channels] = value;
  return (
    ['oklch', 'rgb'].includes(space) &&
    [3, 4].includes(channels.length) &&
    channels.every(
      (c) => typeof c === 'string' && NUMBER.test(c.replace(/%$/, ''))
    )
  );
}

function linkMatches(type, value) {
  if (type === 'color' && Array.isArray(value)) {
    return isFunctionalColor(value);
  }
  return type === 'any' || type === 'action';
}

export function valueMatches(type, value) {
  if (typeof value === 'string' && /^[@$]/.test(value)) {
    return true; // already reported as reserved-sigil
  }
  if (isTypedReference(value)) {
    return value[0] === 'or'
      ? value.slice(1).every((v) => valueMatches(type, v))
      : value.length === 2 && typeof value[1] === 'string';
  }
  if (Array.isArray(type)) {
    return type[0] === 'enum' && type.slice(1).includes(value);
  }
  if (typeof value !== 'string') {
    return linkMatches(type, value);
  }
  return STRING_CHECKS[type]?.(value) ?? true;
}

function checkProperty(element, property, type, vocabulary, diagnostics) {
  const at = { element: element.id, property: property.name };
  if (type === 'action') {
    checkHandler(property.values, vocabulary, diagnostics, at);
    return;
  }
  if (type === undefined || type === 'any' || type === 'string') {
    return;
  }
  for (const value of property.values) {
    if (!valueMatches(type, value)) {
      diagnostics.push({ code: 'invalid-value', severity: 'error', at });
    }
  }
}

/** (on <event> <action>...): actions are data, never code. */
function checkHandler(values, vocabulary, diagnostics, at) {
  const [event, ...actions] = values;
  if (typeof event !== 'string' || actions.length === 0) {
    diagnostics.push({ code: 'invalid-handler', severity: 'error', at });
    return;
  }
  for (const action of actions) {
    if (!Array.isArray(action)) {
      diagnostics.push({ code: 'invalid-handler', severity: 'error', at });
      continue;
    }
    if (!vocabulary.actions.has(action[0])) {
      diagnostics.push({ code: 'unknown-action', severity: 'warning', at });
      continue;
    }
    if (action[0] === 'navigate') {
      const target = String(action[1] ?? '');
      if (/^\s*(javascript|data|vbscript):/i.test(target)) {
        diagnostics.push({ code: 'unsafe-url', severity: 'error', at });
      }
    }
  }
}

/** reference-cycle: token values that refer to each other along a theme chain. */
function checkTokenCycles(tree, diagnostics) {
  const themes = new Map();
  for (const element of tree.elements) {
    if (element.kind !== 'theme') {
      continue;
    }
    const tokens = new Map();
    let base = null;
    for (const property of element.properties) {
      if (property.name === 'token') {
        tokens.set(property.values[0], property.values[1]);
      }
      if (property.name === 'extends') {
        base = property.values[0];
      }
    }
    themes.set(element.id, { tokens, base });
  }
  const lookup = (theme, name, seen = new Set()) => {
    for (
      let t = theme;
      t && themes.has(t) && !seen.has(t);
      t = themes.get(t).base
    ) {
      seen.add(t);
      if (themes.get(t).tokens.has(name)) {
        return themes.get(t).tokens.get(name);
      }
    }
    return undefined;
  };
  const refs = (value) =>
    Array.isArray(value)
      ? value[0] === 'token'
        ? [value[1]]
        : value.flatMap(refs)
      : [];
  for (const [theme, { tokens }] of themes) {
    for (const name of tokens.keys()) {
      const stack = [name];
      const visiting = new Set();
      let cycle = false;
      const walk = (n) => {
        if (visiting.has(n)) {
          cycle = n === name || cycle;
          return;
        }
        visiting.add(n);
        refs(lookup(theme, n)).forEach(walk);
        visiting.delete(n);
      };
      walk(stack[0]);
      if (cycle) {
        diagnostics.push({
          code: 'reference-cycle',
          severity: 'error',
          at: { element: theme, property: 'token', token: name },
        });
      }
    }
  }
}

/** Project LiNo text into { tree, diagnostics } (see docs/spec/). */
export function projectText(text, vocabulary) {
  const parser = new Parser({
    maxDepth: MAX_DEPTH,
    maxInputSize: MAX_INPUT_SIZE,
  });
  const empty = { spec: SPEC_VERSION, elements: [], diagnostics: [] };
  if (text.length > MAX_INPUT_SIZE) {
    const diagnostics = [
      { code: 'input-too-large', severity: 'error', at: {} },
    ];
    return { tree: { ...empty, diagnostics }, diagnostics };
  }
  let links;
  try {
    links = parser.parse(text);
  } catch (error) {
    const code = error.maxDepth ? 'depth-exceeded' : 'syntax-error';
    const at = error.line ? { line: error.line, column: error.column } : {};
    const diagnostics = [{ code, severity: 'error', at }];
    return { tree: { ...empty, diagnostics }, diagnostics };
  }
  const projector = new Projector(vocabulary);
  links.forEach((link) => projector.top(link));
  const tree = { spec: SPEC_VERSION, elements: projector.root.elements };
  if (projector.root.unknown?.length) {
    tree.unknown = projector.root.unknown;
  }
  const diagnostics = projector.diagnostics;
  if (vocabulary.actions.size > 0) {
    checkValues(tree, vocabulary, diagnostics);
    checkTokenCycles(tree, diagnostics);
  }
  tree.diagnostics = diagnostics;
  return { tree, diagnostics };
}

export function loadVocabulary(path = 'docs/spec/vocabulary.lino') {
  return readVocabulary(readFileSync(path, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const vocabulary = loadVocabulary();
  const { tree } = projectText(
    readFileSync(process.argv[2], 'utf8'),
    vocabulary
  );
  console.log(JSON.stringify(tree, null, 2));
}
