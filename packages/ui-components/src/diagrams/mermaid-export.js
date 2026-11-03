/**
 * Diagram model → Mermaid text. Labels are always escaped (Mermaid entity
 * codes), ids that Mermaid cannot read are replaced by safe ones, so the
 * output never carries markup or Mermaid syntax taken from a label.
 */

/** @typedef {import('./diagram-model.js').DiagramModel} DiagramModel */

const DIRECTIONS = Object.freeze({
  down: 'TD',
  up: 'BT',
  right: 'LR',
  left: 'RL',
});

/** Words Mermaid treats as keywords when used as an id. */
const RESERVED = new Set([
  'end',
  'graph',
  'subgraph',
  'flowchart',
  'state',
  'class',
  'direction',
  'style',
  'click',
  'default',
  'participant',
  'actor',
  'note',
  'loop',
  'alt',
  'opt',
  'par',
]);

const SAFE_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Escape a label for a quoted Mermaid string: `#`, `"`, `<`, `>`, `&` and
 * `|` become entity codes and newlines spaces, so a label can never close the string.
 * @param {string} text
 * @returns {string}
 */
export function escapeMermaidLabel(text) {
  return String(text)
    .replace(/#/g, '#35;')
    .replace(/&/g, '#38;')
    .replace(/"/g, '#quot;')
    .replace(/</g, '#lt;')
    .replace(/>/g, '#gt;')
    .replace(/\|/g, '#124;')
    .replace(/\r?\n/g, ' ');
}

/** An edge label that needs no quotes (`yes`, `Signed in?`). */
const PLAIN_EDGE_LABEL = /^[A-Za-z0-9 _.,?!'-]+$/;

const edgeLabel = (label) =>
  PLAIN_EDGE_LABEL.test(label) ? label : `"${escapeMermaidLabel(label)}"`;

/**
 * Map every node and group id to an id Mermaid can read; a safe id keeps
 * its name, others become `n_<name>` with a counter on collisions.
 * @param {DiagramModel} model
 * @returns {Map<string, string>}
 */
function mermaidIds(model) {
  const ids = new Map();
  const used = new Set();
  const all = [...model.groups, ...model.nodes].map((item) => item.id);
  for (const id of all) {
    if (SAFE_ID.test(id) && !RESERVED.has(id.toLowerCase())) {
      ids.set(id, id);
      used.add(id);
    }
  }
  for (const id of all) {
    if (ids.has(id)) {
      continue;
    }
    const base = `n_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
    let candidate = base;
    for (let i = 2; used.has(candidate); i += 1) {
      candidate = `${base}_${i}`;
    }
    ids.set(id, candidate);
    used.add(candidate);
  }
  return ids;
}

const FLOW_SHAPES = Object.freeze({
  box: ['[', ']'],
  round: ['(', ')'],
  stadium: ['([', '])'],
  circle: ['((', '))'],
  diamond: ['{', '}'],
  start: ['((', '))'],
  end: ['(((', ')))'],
});

/**
 * Lines of the items of each group, nested: `open(group)`, the children,
 * `close`. Items outside every group come first.
 */
function nested(model, lineOf, open, close) {
  const lines = [];
  const visit = (groupId, depth) => {
    const pad = '  '.repeat(depth);
    for (const group of model.groups.filter((g) => g.group === groupId)) {
      lines.push(pad + open(group));
      visit(group.id, depth + 1);
      lines.push(pad + close);
    }
    for (const node of model.nodes.filter((n) => n.group === groupId)) {
      const line = lineOf(node);
      if (line !== null) {
        lines.push(pad + line);
      }
    }
  };
  visit(null, 1);
  return lines;
}

function flowchart(model) {
  const ids = mermaidIds(model);
  const lines = [`flowchart ${DIRECTIONS[model.direction]}`];
  lines.push(
    ...nested(
      model,
      (node) => {
        const [open, close] = FLOW_SHAPES[node.shape];
        return `${ids.get(node.id)}${open}"${escapeMermaidLabel(node.label)}"${close}`;
      },
      (group) =>
        `subgraph ${ids.get(group.id)} ["${escapeMermaidLabel(group.label)}"]`,
      'end'
    )
  );
  for (const edge of model.edges) {
    const arrow = edge.label === null ? '-->' : `-->|${edgeLabel(edge.label)}|`;
    lines.push(`  ${ids.get(edge.from)} ${arrow} ${ids.get(edge.to)}`);
  }
  return lines;
}

const isPseudo = (node) => node.shape === 'start' || node.shape === 'end';

function state(model) {
  const ids = mermaidIds(model);
  const lines = [
    'stateDiagram-v2',
    `  direction ${DIRECTIONS[model.direction].replace('TD', 'TB')}`,
  ];
  lines.push(
    ...nested(
      model,
      (node) =>
        isPseudo(node)
          ? null
          : `state "${escapeMermaidLabel(node.label)}" as ${ids.get(node.id)}`,
      (group) =>
        `state "${escapeMermaidLabel(group.label)}" as ${ids.get(group.id)} {`,
      '}'
    )
  );
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const end = (id) => (isPseudo(nodes.get(id)) ? '[*]' : ids.get(id));
  for (const edge of model.edges) {
    const label =
      edge.label === null ? '' : ` : ${escapeMermaidLabel(edge.label)}`;
    lines.push(`  ${end(edge.from)} --> ${end(edge.to)}${label}`);
  }
  return lines;
}

function sequence(model) {
  const ids = mermaidIds(model);
  const lines = ['sequenceDiagram'];
  for (const node of model.nodes) {
    lines.push(
      `  participant ${ids.get(node.id)} as ${escapeMermaidLabel(node.label)}`
    );
  }
  for (const edge of model.edges) {
    const label = escapeMermaidLabel(edge.label ?? '');
    lines.push(`  ${ids.get(edge.from)}->>${ids.get(edge.to)}: ${label}`);
  }
  return lines;
}

function classDiagram(model) {
  const ids = mermaidIds(model);
  const lines = [
    'classDiagram',
    `  direction ${DIRECTIONS[model.direction].replace('TD', 'TB')}`,
  ];
  for (const node of model.nodes) {
    lines.push(
      `  class ${ids.get(node.id)}["${escapeMermaidLabel(node.label)}"]`
    );
  }
  for (const edge of model.edges) {
    const label =
      edge.label === null ? '' : ` : ${escapeMermaidLabel(edge.label)}`;
    lines.push(`  ${ids.get(edge.from)} --> ${ids.get(edge.to)}${label}`);
  }
  return lines;
}

const WRITERS = Object.freeze({
  flowchart,
  state,
  sequence,
  class: classDiagram,
});

/**
 * Mermaid text of a diagram model (`flowchart`, `state`, `sequence` and
 * `class` kinds), without a trailing newline.
 * @param {DiagramModel} model
 * @returns {string}
 */
export function toMermaid(model) {
  const write = WRITERS[model.kind];
  if (!write) {
    throw new TypeError(`toMermaid: unknown diagram kind "${model.kind}"`);
  }
  return write(model).join('\n');
}
