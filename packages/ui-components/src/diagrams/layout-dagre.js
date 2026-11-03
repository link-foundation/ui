/**
 * The default layered layout of a diagram, computed by Dagre
 * (`@dagrejs/dagre`, MIT). Deterministic: the same model and options give the
 * same coordinates, rounded to 1/100 px.
 */

import dagre from '@dagrejs/dagre';

/** @typedef {import('./diagram-model.js').DiagramModel} DiagramModel */
/** @typedef {import('./diagram-model.js').DiagramNode} DiagramNode */

/**
 * @typedef {object} Size
 * @property {number} width
 * @property {number} height
 *
 * @typedef {object} Box  `x`, `y`: the centre of the box
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 *
 * @typedef {object} EdgeLayout
 * @property {string} id
 * @property {{x: number, y: number}[]} points  from the source border to the
 *   target border
 * @property {{x: number, y: number}|null} labelAt  the centre of the label
 *
 * @typedef {object} Layout  the result of every layout engine
 * @property {number} width  of the whole drawing
 * @property {number} height
 * @property {Box[]} nodes  in the order of `model.nodes`
 * @property {EdgeLayout[]} edges  in the order of `model.edges`
 * @property {Box[]} groups  in the order of `model.groups`
 *
 * @typedef {object} LayoutOptions
 * @property {Size|((node: DiagramNode) => Size)} [nodeSize]  default: from
 *   the label length (`estimateNodeSize`)
 * @property {number} [rankSep]  space between ranks (default 56)
 * @property {number} [nodeSep]  space between nodes of a rank (default 40)
 * @property {number} [margin]  around the drawing (default 16)
 */

const RANKDIR = Object.freeze({
  down: 'TB',
  up: 'BT',
  right: 'LR',
  left: 'RL',
});

/** Average glyph width of the default 14 px sans-serif font. */
export const CHAR_WIDTH = 8;
export const LINE_HEIGHT = 20;

/**
 * The default size of a node: wide enough for its label in a 14 px font.
 * @param {DiagramNode} node
 * @returns {Size}
 */
export function estimateNodeSize(node) {
  if (node.shape === 'start' || node.shape === 'end') {
    return { width: 24, height: 24 };
  }
  const text = node.label.length * CHAR_WIDTH;
  const width = Math.max(72, text + 32);
  if (node.shape === 'diamond') {
    return { width: Math.round(width * 1.5), height: 72 };
  }
  if (node.shape === 'circle') {
    const side = Math.max(width, 56);
    return { width: side, height: side };
  }
  return { width, height: 40 };
}

/**
 * The size of an edge label, as given to Dagre so labels get room.
 * @param {string|null} label
 * @returns {Size}
 */
export function edgeLabelSize(label) {
  return label === null
    ? { width: 0, height: 0 }
    : { width: label.length * 7 + 8, height: LINE_HEIGHT };
}

const round = (value) => Math.round(value * 100) / 100;
const box = (id, value) => ({
  id,
  x: round(value.x),
  y: round(value.y),
  width: round(value.width),
  height: round(value.height),
});

function sizeOf(node, nodeSize) {
  if (typeof nodeSize === 'function') {
    return nodeSize(node);
  }
  return nodeSize ?? estimateNodeSize(node);
}

/**
 * Lay a diagram out with Dagre.
 * @param {DiagramModel} model
 * @param {LayoutOptions} [options]
 * @returns {Layout}
 */
export function layoutDiagram(model, options = {}) {
  const margin = options.margin ?? 16;
  const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  graph.setGraph({
    rankdir: RANKDIR[model.direction] ?? 'TB',
    ranksep: options.rankSep ?? 56,
    nodesep: options.nodeSep ?? 40,
    edgesep: 16,
    marginx: margin,
    marginy: margin,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const group of model.groups) {
    graph.setNode(group.id, {
      label: group.label,
      paddingTop: LINE_HEIGHT + 8,
      width: group.label.length * CHAR_WIDTH + 24,
      height: LINE_HEIGHT + 16,
    });
  }
  for (const node of model.nodes) {
    const { width, height } = sizeOf(node, options.nodeSize);
    graph.setNode(node.id, { width, height });
  }
  for (const item of [...model.groups, ...model.nodes]) {
    if (item.group !== null) {
      graph.setParent(item.id, item.group);
    }
  }
  for (const edge of model.edges) {
    graph.setEdge(
      edge.from,
      edge.to,
      { ...edgeLabelSize(edge.label), labelpos: 'c' },
      edge.id
    );
  }
  dagre.layout(graph);
  const size = graph.graph();
  return {
    width: round(size.width),
    height: round(size.height),
    nodes: model.nodes.map((node) => box(node.id, graph.node(node.id))),
    edges: model.edges.map((edge) => {
      const value = graph.edge(edge.from, edge.to, edge.id);
      return {
        id: edge.id,
        points: value.points.map((p) => ({ x: round(p.x), y: round(p.y) })),
        labelAt:
          edge.label === null ? null : { x: round(value.x), y: round(value.y) },
      };
    }),
    groups: model.groups.map((group) => box(group.id, graph.node(group.id))),
  };
}
