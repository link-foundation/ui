/**
 * Our SVG renderer of `flowchart` and `state` diagrams: a model and its
 * layout become one deterministic SVG string. Every label is escaped text;
 * colours come from design tokens (CSS custom properties of
 * `@link-foundation/ui-tokens`, with fallbacks), so the drawing follows the
 * theme and `prefers-color-scheme` of the page.
 */

import { describeDiagram } from './diagram-model.js';

/** @typedef {import('./diagram-model.js').DiagramModel} DiagramModel */
/** @typedef {import('./layout-dagre.js').Layout} Layout */

/**
 * The colours and font of a drawing: any CSS value (`#1d1b20`,
 * `var(--color-on-surface)`).
 * @typedef {object} DiagramTokens
 * @property {string} [surface]  node fill
 * @property {string} [onSurface]  text and node outline
 * @property {string} [edge]  edge lines and arrowheads
 * @property {string} [group]  group fill
 * @property {string} [groupOutline]
 * @property {string} [accent]  start and end states
 * @property {string} [fontFamily]
 * @property {number} [fontSize]  in px
 */

/** @type {Readonly<Required<DiagramTokens>>} */
export const DEFAULT_DIAGRAM_TOKENS = Object.freeze({
  surface: 'var(--color-surface, #fffbfe)',
  onSurface: 'var(--color-on-surface, #1d1b20)',
  edge: 'var(--color-on-surface-variant, #49454f)',
  group: 'var(--color-surface-container, #f3edf7)',
  groupOutline: 'var(--color-outline, #79747e)',
  accent: 'var(--color-primary, #6750a4)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
});

export const SVG_KINDS = Object.freeze(['flowchart', 'state']);

const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape text for XML text and attribute values.
 * @param {string} text
 * @returns {string}
 */
export function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/** A CSS value that is safe inside a `style` attribute. */
function cssValue(value) {
  const text = String(value);
  if (/[;{}<>"\\]/.test(text)) {
    throw new TypeError(
      `renderDiagramSvg: unsafe token value ${JSON.stringify(text)}`
    );
  }
  return text;
}

/** A font size in px: a positive finite number. */
function fontSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    throw new TypeError(
      `renderDiagramSvg: fontSize must be a positive number, not ${JSON.stringify(value)}`
    );
  }
  return size;
}

const num = (value) => String(Math.round(value * 100) / 100);

/** A safe id fragment for `id` attributes: letters, digits, `-` and `_`. */
const idPart = (text) => String(text).replace(/[^A-Za-z0-9_-]/g, '_');

function shapeSvg(node, b, t) {
  const left = b.x - b.width / 2;
  const top = b.y - b.height / 2;
  const fill = `fill:${t.surface};stroke:${t.onSurface};stroke-width:1.5`;
  switch (node.shape) {
    case 'diamond':
      return `<polygon points="${num(b.x)},${num(top)} ${num(left + b.width)},${num(b.y)} ${num(b.x)},${num(top + b.height)} ${num(left)},${num(b.y)}" style="${fill}"/>`;
    case 'circle':
      return `<ellipse cx="${num(b.x)}" cy="${num(b.y)}" rx="${num(b.width / 2)}" ry="${num(b.height / 2)}" style="${fill}"/>`;
    case 'start':
      return `<circle cx="${num(b.x)}" cy="${num(b.y)}" r="${num(Math.min(b.width, b.height) / 2)}" style="fill:${t.accent}"/>`;
    case 'end': {
      const r = Math.min(b.width, b.height) / 2;
      return `<circle cx="${num(b.x)}" cy="${num(b.y)}" r="${num(r)}" style="fill:none;stroke:${t.accent};stroke-width:2"/><circle cx="${num(b.x)}" cy="${num(b.y)}" r="${num(r - 5)}" style="fill:${t.accent}"/>`;
    }
    default: {
      const radius =
        { box: 4, round: 12, stadium: b.height / 2 }[node.shape] ?? 4;
      return `<rect x="${num(left)}" y="${num(top)}" width="${num(b.width)}" height="${num(b.height)}" rx="${num(radius)}" style="${fill}"/>`;
    }
  }
}

function textSvg(x, y, text, t, { size = t.fontSize, extra = '' } = {}) {
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="middle" dominant-baseline="central" style="fill:${t.onSurface};font-family:${t.fontFamily};font-size:${num(size)}px${extra}">${escapeXml(text)}</text>`;
}

function nodeSvg(node, b, t) {
  const label =
    node.shape === 'start' || node.shape === 'end'
      ? ''
      : textSvg(b.x, b.y, node.label, t);
  return `<g class="ui-diagram-node" data-id="${escapeXml(node.id)}">${shapeSvg(node, b, t)}${label}</g>`;
}

function edgeSvg(edge, e, t, markerId) {
  const d = e.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`)
    .join(' ');
  let label = '';
  if (edge.label !== null) {
    const at = e.labelAt ?? e.points[Math.floor(e.points.length / 2)];
    const width = edge.label.length * 7 + 8;
    label = `<rect x="${num(at.x - width / 2)}" y="${num(at.y - 10)}" width="${num(width)}" height="20" rx="4" style="fill:${t.surface}"/>${textSvg(at.x, at.y, edge.label, t, { size: t.fontSize - 2 })}`;
  }
  return `<g class="ui-diagram-edge" data-id="${escapeXml(edge.id)}"><path d="${d}" marker-end="url(#${markerId})" style="fill:none;stroke:${t.edge};stroke-width:1.5"/>${label}</g>`;
}

function groupSvg(group, b, t) {
  const left = b.x - b.width / 2;
  const top = b.y - b.height / 2;
  return `<g class="ui-diagram-group" data-id="${escapeXml(group.id)}"><rect x="${num(left)}" y="${num(top)}" width="${num(b.width)}" height="${num(b.height)}" rx="8" style="fill:${t.group};stroke:${t.groupOutline};stroke-dasharray:4 3"/>${textSvg(b.x, top + 14, group.label, t, { extra: ';font-weight:600' })}</g>`;
}

/**
 * A one-sentence summary of a diagram, used as its accessible name.
 * @param {DiagramModel} model
 * @returns {string}
 */
export function diagramSummary(model) {
  const kind =
    model.kind === 'flowchart'
      ? 'Flowchart'
      : `${model.kind[0].toUpperCase()}${model.kind.slice(1)} diagram`;
  const title = model.label ?? model.id;
  const { nodes, edges } = describeDiagram(model);
  return `${kind} ${title}: ${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'}, ${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}`;
}

/** Group depth, so outer groups are drawn under inner ones. */
function depthOf(model, group) {
  const parents = new Map(model.groups.map((g) => [g.id, g.group]));
  let depth = 0;
  for (let at = group.group; at !== null; at = parents.get(at) ?? null) {
    depth += 1;
  }
  return depth;
}

/**
 * Render a laid-out diagram as an SVG string (`role="img"` with an
 * `aria-label`, and the same summary as `<title>`). Deterministic: the same arguments give the
 * same string.
 * @param {DiagramModel} model
 * @param {Layout} layout
 * @param {DiagramTokens & {idPrefix?: string}} [tokens]  `idPrefix` makes
 *   the marker id unique when one model is drawn twice on a page
 * @returns {string}
 */
export function renderDiagramSvg(model, layout, tokens = {}) {
  if (!SVG_KINDS.includes(model.kind)) {
    throw new TypeError(
      `renderDiagramSvg: ${model.kind} diagrams are drawn by Mermaid (toMermaid)`
    );
  }
  const { idPrefix, ...overrides } = tokens;
  const t = Object.fromEntries(
    Object.entries({ ...DEFAULT_DIAGRAM_TOKENS, ...overrides }).map(
      ([k, v]) => [k, k === 'fontSize' ? fontSize(v) : cssValue(v)]
    )
  );
  const prefix = idPart(idPrefix ?? `ui-diagram-${model.id}`);
  const markerId = `${prefix}-arrow`;
  const nodes = new Map(layout.nodes.map((b) => [b.id, b]));
  const edges = new Map(layout.edges.map((e) => [e.id, e]));
  const groups = new Map((layout.groups ?? []).map((b) => [b.id, b]));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="ui-diagram-svg" viewBox="0 0 ${num(layout.width)} ${num(layout.height)}" width="${num(layout.width)}" height="${num(layout.height)}" role="img" aria-label="${escapeXml(diagramSummary(model))}">`,
    `<title id="${prefix}-title">${escapeXml(diagramSummary(model))}</title>`,
    `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:${t.edge}"/></marker></defs>`,
  ];
  const sorted = [...model.groups].sort(
    (a, b) => depthOf(model, a) - depthOf(model, b)
  );
  for (const group of sorted) {
    if (groups.has(group.id)) {
      parts.push(groupSvg(group, groups.get(group.id), t));
    }
  }
  for (const edge of model.edges) {
    if (edges.has(edge.id)) {
      parts.push(edgeSvg(edge, edges.get(edge.id), t, markerId));
    }
  }
  for (const node of model.nodes) {
    parts.push(nodeSvg(node, nodes.get(node.id), t));
  }
  parts.push('</svg>');
  return parts.join('');
}
