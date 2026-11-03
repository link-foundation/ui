/**
 * The diagram dialect: a diagram written in Links Notation, read into a plain
 * `DiagramModel` and written back. Pure: no DOM, no layout.
 *
 * ```lino
 * (login-flow: diagram
 *   (kind flowchart)
 *   (direction down)
 *   (start: node (label 'Start'))
 *   (check: node (label 'Signed in?') (shape diamond))
 *   (edge (from start) (to check) (label 'yes')))
 * ```
 *
 * Links come from the official `links-notation` parser; the multi-line form
 * `(H (H a) (H b))` it returns is folded back into `(H a b)` here.
 */

import { formatLinks, parseNested } from '@link-foundation/ui-core';
import { Link } from 'links-notation';

/** @typedef {'flowchart'|'sequence'|'state'|'class'} DiagramKind */
/** @typedef {'down'|'up'|'right'|'left'} DiagramDirection */

/**
 * @typedef {object} DiagramNode
 * @property {string} id
 * @property {string} label  the text shown (defaults to the id)
 * @property {string} shape  one of `NODE_SHAPES` (default `box`)
 * @property {string|null} group  the id of the group the node is in
 *
 * @typedef {object} DiagramEdge
 * @property {string} id  given, or `edge-N` (N counts the edges from 1)
 * @property {string} from  a node id
 * @property {string} to  a node id
 * @property {string|null} label
 *
 * @typedef {object} DiagramGroup
 * @property {string} id
 * @property {string} label
 * @property {string|null} group  the id of the enclosing group
 *
 * @typedef {object} DiagramModel
 * @property {string} id
 * @property {DiagramKind} kind
 * @property {DiagramDirection} direction
 * @property {string|null} label  an accessible title (optional)
 * @property {'svg'|'mermaid'|null} renderer  `null`: the default renderer
 * @property {string|null} layout  a registered layout name (`null`: dagre)
 * @property {DiagramNode[]} nodes
 * @property {DiagramEdge[]} edges
 * @property {DiagramGroup[]} groups
 */

export const DIAGRAM_KINDS = Object.freeze([
  'flowchart',
  'sequence',
  'state',
  'class',
]);
export const DIAGRAM_DIRECTIONS = Object.freeze([
  'down',
  'up',
  'right',
  'left',
]);
export const NODE_SHAPES = Object.freeze([
  'box',
  'round',
  'stadium',
  'circle',
  'diamond',
  'start',
  'end',
]);
export const DIAGRAM_RENDERERS = Object.freeze(['svg', 'mermaid']);

const DEFAULTS = Object.freeze({
  kind: 'flowchart',
  direction: 'down',
  shape: 'box',
});

/** A problem in a diagram, with the position of the offending link. */
export class DiagramError extends Error {
  /**
   * @param {string} code  `no-diagram`, `unknown-node`, `unknown-group`,
   *   `duplicate-id`, `invalid-value`, `unknown-property`, `missing-value`
   * @param {string} message
   * @param {{diagram?: string, path: number[], link?: string}} at  `path`:
   *   the index of the diagram link among the parsed links, then the index
   *   of the offending link inside the diagram (1 = the first child)
   */
  constructor(code, message, at) {
    super(message);
    this.name = 'DiagramError';
    this.code = code;
    this.at = at;
  }
}

const keyOf = (link) => String(link);

/** Whether `link` is a reference (no values): `start`, `'Signed in?'`. */
const isRef = (link) => link.values.length === 0 && link.id !== null;

/**
 * Fold the multi-line form `(H (H a) (H b))` into `(H a b)`, recursively.
 * @param {Link} link
 * @returns {Link}
 */
export function foldLink(link) {
  const [head, ...rest] = link.values;
  const isWrapper =
    link.id === null &&
    rest.length > 0 &&
    rest.every(
      (value) =>
        value.id === null &&
        value.values.length >= 2 &&
        keyOf(value.values[0]) === keyOf(head)
    );
  if (isWrapper) {
    const payload = rest.flatMap((value) => value.values.slice(1));
    return foldLink(new Link(head.id, [...head.values, ...payload]));
  }
  return new Link(link.id, link.values.map(foldLink));
}

/** The words of a sublink `(name word...)`, or null if it is not one. */
function sublink(link) {
  if (link.id !== null || link.values.length === 0) {
    return null;
  }
  const [name, ...values] = link.values;
  if (!isRef(name) || !values.every(isRef)) {
    return null;
  }
  return { name: name.id, words: values.map((value) => value.id) };
}

/** Reads the children of one diagram link and reports problems. */
class Reader {
  constructor(diagramId, index) {
    this.diagramId = diagramId;
    this.index = index;
  }

  fail(code, message, child, link) {
    const where =
      child === undefined
        ? `diagram "${this.diagramId}"`
        : `link ${child} of diagram "${this.diagramId}"`;
    throw new DiagramError(code, `${where}: ${message}`, {
      diagram: this.diagramId,
      path: child === undefined ? [this.index] : [this.index, child],
      ...(link ? { link: String(link) } : {}),
    });
  }

  /** The properties `(name value)` of an item link, checked by `allowed`. */
  props(values, allowed, child, link) {
    const props = {};
    for (const value of values) {
      const prop = sublink(value);
      if (!prop || !allowed.includes(prop.name)) {
        const what = prop ? `"${prop.name}"` : String(value);
        this.fail(
          'unknown-property',
          `unknown property ${what} (allowed: ${allowed.join(', ')})`,
          child,
          link
        );
      }
      if (prop.words.length === 0) {
        this.fail('missing-value', `"${prop.name}" needs a value`, child, link);
      }
      if (prop.name in props) {
        this.fail('duplicate-id', `"${prop.name}" is set twice`, child, link);
      }
      props[prop.name] = prop.words.join(' ');
    }
    return props;
  }

  oneOf(value, allowed, what, child, link) {
    if (!allowed.includes(value)) {
      this.fail(
        'invalid-value',
        `${what} "${value}" is not one of ${allowed.join(', ')}`,
        child,
        link
      );
    }
    return value;
  }
}

/** Split `(id: type props...)` / `(type props...)` into its parts. */
function itemOf(link) {
  const [type, ...rest] = link.values;
  if (!type || !isRef(type)) {
    return null;
  }
  return { id: link.id, type: type.id, rest };
}

const DIAGRAM_PROPS = ['kind', 'direction', 'label', 'renderer', 'layout'];

/** Read the settings and items of a diagram link. */
function readItems(reader, items, model) {
  const settings = [];
  const pending = { nodes: [], edges: [], groups: [] };
  items.forEach((link, i) => {
    const child = i + 1;
    const prop = sublink(link);
    if (prop && DIAGRAM_PROPS.includes(prop.name)) {
      settings.push([prop.name, reader.props([link], DIAGRAM_PROPS, child)]);
      return;
    }
    const item = itemOf(link);
    const bucket = { node: 'nodes', edge: 'edges', group: 'groups' }[
      item?.type
    ];
    if (!bucket) {
      reader.fail(
        'unknown-property',
        `expected (kind …), (direction …), (label …), (renderer …), (layout …), a node, an edge or a group, got ${String(link)}`,
        child,
        link
      );
    }
    if (bucket !== 'edges' && item.id === null) {
      reader.fail('missing-value', `a ${item.type} needs an id`, child, link);
    }
    pending[bucket].push({ item, child, link });
  });
  for (const [, props] of settings) {
    Object.assign(model, props);
  }
  return pending;
}

/** Check the settings of the model and fill in the defaults. */
function checkSettings(reader, model) {
  model.kind = reader.oneOf(model.kind, DIAGRAM_KINDS, 'kind');
  model.direction = reader.oneOf(
    model.direction,
    DIAGRAM_DIRECTIONS,
    'direction'
  );
  if (model.renderer !== null) {
    reader.oneOf(model.renderer, DIAGRAM_RENDERERS, 'renderer');
  }
}

function claimId(reader, ids, id, child, link) {
  if (ids.has(id)) {
    reader.fail('duplicate-id', `the id "${id}" is used twice`, child, link);
  }
  ids.add(id);
}

/** Build the nodes, groups and edges and check every reference. */
function buildItems(reader, pending, model) {
  const ids = new Set([model.id]);
  for (const { item, child, link } of pending.groups) {
    claimId(reader, ids, item.id, child, link);
    const props = reader.props(item.rest, ['label', 'group'], child, link);
    model.groups.push({
      id: item.id,
      label: props.label ?? item.id,
      group: props.group ?? null,
      child,
      link,
    });
  }
  for (const { item, child, link } of pending.nodes) {
    claimId(reader, ids, item.id, child, link);
    const props = reader.props(
      item.rest,
      ['label', 'shape', 'group'],
      child,
      link
    );
    model.nodes.push({
      id: item.id,
      label: props.label ?? item.id,
      shape: reader.oneOf(
        props.shape ?? DEFAULTS.shape,
        NODE_SHAPES,
        'shape',
        child,
        link
      ),
      group: props.group ?? null,
      child,
      link,
    });
  }
  const groupIds = new Set(model.groups.map((group) => group.id));
  for (const entry of [...model.groups, ...model.nodes]) {
    if (entry.group !== null && !groupIds.has(entry.group)) {
      reader.fail(
        'unknown-group',
        `unknown group "${entry.group}" in ${String(entry.link)}`,
        entry.child,
        entry.link
      );
    }
  }
  checkGroupCycles(reader, model.groups);
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  pending.edges.forEach(({ item, child, link }, i) => {
    const id = item.id ?? `edge-${i + 1}`;
    claimId(reader, ids, id, child, link);
    const props = reader.props(item.rest, ['from', 'to', 'label'], child, link);
    for (const end of ['from', 'to']) {
      if (props[end] === undefined) {
        reader.fail('missing-value', `an edge needs (${end} …)`, child, link);
      }
      if (!nodeIds.has(props[end])) {
        reader.fail(
          'unknown-node',
          `unknown node "${props[end]}" in ${String(link)}`,
          child,
          link
        );
      }
    }
    model.edges.push({
      id,
      from: props.from,
      to: props.to,
      label: props.label ?? null,
    });
  });
  for (const list of [model.groups, model.nodes]) {
    for (const entry of list) {
      delete entry.child;
      delete entry.link;
    }
  }
}

function checkGroupCycles(reader, groups) {
  const parent = new Map(groups.map((group) => [group.id, group.group]));
  for (const group of groups) {
    const seen = new Set([group.id]);
    for (let at = group.group; at !== null; at = parent.get(at)) {
      if (seen.has(at)) {
        reader.fail(
          'invalid-value',
          `group "${group.id}" is inside itself`,
          group.child,
          group.link
        );
      }
      seen.add(at);
    }
  }
}

/** Read one folded `(id: diagram ...)` link. */
function readDiagram(link, index) {
  const reader = new Reader(link.id, index);
  /** @type {DiagramModel} */
  const model = {
    id: link.id,
    kind: DEFAULTS.kind,
    direction: DEFAULTS.direction,
    label: null,
    renderer: null,
    layout: null,
    nodes: [],
    edges: [],
    groups: [],
  };
  const pending = readItems(reader, link.values.slice(1), model);
  checkSettings(reader, model);
  buildItems(reader, pending, model);
  return model;
}

const isDiagramLink = (link) =>
  link.id !== null && link.values[0]?.id === 'diagram' && isRef(link.values[0]);

/**
 * Every diagram of a parsed document (`(id: diagram ...)` links).
 * @param {Link[]} links  the result of the `links-notation` parser
 * @returns {DiagramModel[]}
 */
export function diagramsFromLinks(links) {
  const models = [];
  links.forEach((raw, index) => {
    const link = foldLink(raw);
    if (isDiagramLink(link)) {
      models.push(readDiagram(link, index));
    }
  });
  return models;
}

/**
 * The first diagram of a parsed document.
 * @param {Link[]} links  the result of the `links-notation` parser
 * @returns {DiagramModel} `{ kind, direction, nodes, edges, groups, ... }`
 * @throws {DiagramError} when there is no diagram or it is invalid (an edge
 *   to an unknown node id names the position of the edge link)
 */
export function diagramFromLinks(links) {
  const [model] = diagramsFromLinks(links);
  if (!model) {
    throw new DiagramError(
      'no-diagram',
      'no (id: diagram ...) link was found',
      {
        path: [],
      }
    );
  }
  return model;
}

/**
 * Parse Links Notation text with `links-notation` and read its first diagram.
 * @param {string} text
 * @returns {DiagramModel}
 */
export function parseDiagram(text) {
  return diagramFromLinks(parseNested(text));
}

const ref = (id) => new Link(id);
const prop = (name, value) => new Link(null, [ref(name), ref(value)]);

/** The item links of a model, without defaults that equal the default. */
function itemLinks(model) {
  const links = [];
  const groups = model.groups.map((group) => {
    const values = [ref('group')];
    if (group.label !== group.id) {
      values.push(prop('label', group.label));
    }
    if (group.group !== null) {
      values.push(prop('group', group.group));
    }
    return new Link(group.id, values);
  });
  const nodes = model.nodes.map((node) => {
    const values = [ref('node')];
    if (node.label !== node.id) {
      values.push(prop('label', node.label));
    }
    if (node.shape !== DEFAULTS.shape) {
      values.push(prop('shape', node.shape));
    }
    if (node.group !== null) {
      values.push(prop('group', node.group));
    }
    return new Link(node.id, values);
  });
  const edges = model.edges.map((edge, i) => {
    const values = [ref('edge'), prop('from', edge.from), prop('to', edge.to)];
    if (edge.label !== null) {
      values.push(prop('label', edge.label));
    }
    return new Link(edge.id === `edge-${i + 1}` ? null : edge.id, values);
  });
  links.push(...groups, ...nodes, ...edges);
  return links;
}

/**
 * Write a diagram model as Links Notation in the nested form (#133): the
 * `diagram` line, then one indented block per setting, group, node and edge.
 * @param {DiagramModel} model
 * @returns {string} LiNo text that `parseDiagram` reads back into `model`
 */
export function diagramToLino(model) {
  const settings = [
    prop('kind', model.kind),
    prop('direction', model.direction),
  ];
  for (const name of ['label', 'renderer', 'layout']) {
    if (model[name] !== null && model[name] !== undefined) {
      settings.push(prop(name, model[name]));
    }
  }
  return formatLinks([
    new Link(model.id, [ref('diagram'), ...settings, ...itemLinks(model)]),
  ]);
}

/**
 * The plain-English description of a diagram for screen readers: one line
 * per node and per edge ("Start leads to Signed in?").
 * @param {DiagramModel} model
 * @returns {{nodes: string[], edges: string[]}}
 */
export function describeDiagram(model) {
  const labels = new Map(model.nodes.map((node) => [node.id, node.label]));
  return {
    nodes: model.nodes.map((node) => node.label),
    edges: model.edges.map(
      (edge) =>
        `${labels.get(edge.from)} leads to ${labels.get(edge.to)}${
          edge.label === null ? '' : ` (${edge.label})`
        }`
    ),
  };
}
