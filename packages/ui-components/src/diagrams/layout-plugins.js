/**
 * Layout plugins: an app registers another layout engine (ELK.js, Graphviz
 * through `@hpcc-js/wasm-graphviz`, …) under a name and a diagram picks it
 * with `(layout NAME)`. This package ships only `dagre`; EPL-licensed
 * engines stay in the app. A plugin wrapping ELK.js in the app:
 *
 * ```js
 * import ELK from 'elkjs/lib/elk.bundled.js'; // EPL-2.0: the app's choice
 * import { registerLayout, estimateNodeSize } from '@link-foundation/ui-components/diagrams';
 *
 * const elk = new ELK();
 * registerLayout('elk', async (model) => {
 *   const sizes = new Map(model.nodes.map((n) => [n.id, estimateNodeSize(n)]));
 *   const graph = await elk.layout({
 *     id: model.id,
 *     layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN' },
 *     children: model.nodes.map((n) => ({ id: n.id, ...sizes.get(n.id) })),
 *     edges: model.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
 *   });
 *   const at = new Map(graph.children.map((c) => [c.id, c]));
 *   return {
 *     width: graph.width,
 *     height: graph.height,
 *     // Layout boxes use the centre, ELK the top-left corner.
 *     nodes: model.nodes.map((n) => {
 *       const c = at.get(n.id);
 *       return { id: n.id, x: c.x + c.width / 2, y: c.y + c.height / 2, width: c.width, height: c.height };
 *     }),
 *     edges: graph.edges.map((e) => {
 *       const s = e.sections[0];
 *       return { id: e.id, points: [s.startPoint, ...(s.bendPoints ?? []), s.endPoint], labelAt: null };
 *     }),
 *     groups: [],
 *   };
 * });
 * ```
 */

import { layoutDiagram } from './layout-dagre.js';

/** @typedef {import('./diagram-model.js').DiagramModel} DiagramModel */
/** @typedef {import('./layout-dagre.js').Layout} Layout */
/**
 * @typedef {(model: DiagramModel, options: object) => Layout|Promise<Layout>}
 *   LayoutEngine
 */

export const DEFAULT_LAYOUT = 'dagre';

/** @type {Map<string, LayoutEngine>} */
const engines = new Map([[DEFAULT_LAYOUT, layoutDiagram]]);

/**
 * Register (or replace) a layout engine.
 * @param {string} name
 * @param {LayoutEngine} engine
 */
export function registerLayout(name, engine) {
  if (typeof name !== 'string' || name === '') {
    throw new TypeError('registerLayout: the name must be a non-empty string');
  }
  if (typeof engine !== 'function') {
    throw new TypeError(
      `registerLayout(${name}): the engine must be a function`
    );
  }
  engines.set(name, engine);
}

/**
 * Remove a registered engine (`dagre` cannot be removed).
 * @param {string} name
 * @returns {boolean} whether an engine was removed
 */
export function unregisterLayout(name) {
  return name !== DEFAULT_LAYOUT && engines.delete(name);
}

/** @returns {string[]} the registered engine names, sorted */
export function registeredLayouts() {
  return [...engines.keys()].sort();
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Throw a TypeError when a plugin returns a malformed layout. */
function checkLayout(name, model, layout) {
  const fail = (what) => {
    throw new TypeError(`layout "${name}" returned ${what}`);
  };
  if (!layout || !isNumber(layout.width) || !isNumber(layout.height)) {
    fail('no width and height');
  }
  const boxes = new Map((layout.nodes ?? []).map((b) => [b.id, b]));
  for (const node of model.nodes) {
    const b = boxes.get(node.id);
    if (!b || ![b.x, b.y, b.width, b.height].every(isNumber)) {
      fail(`no box for node "${node.id}"`);
    }
  }
  for (const edge of layout.edges ?? []) {
    if (!Array.isArray(edge.points) || edge.points.length < 2) {
      fail(`fewer than two points for edge "${edge.id}"`);
    }
  }
  return layout;
}

/**
 * Lay a diagram out with a registered engine (`model.layout`, else `name`,
 * else `dagre`). The result is checked and has an entry per node.
 * @param {DiagramModel} model
 * @param {object} [options]  passed to the engine
 * @param {string} [name]
 * @returns {Promise<Layout>}
 */
export async function runLayout(model, options = {}, name = undefined) {
  const engineName = name ?? model.layout ?? DEFAULT_LAYOUT;
  const engine = engines.get(engineName);
  if (!engine) {
    throw new Error(
      `unknown layout "${engineName}" (registered: ${registeredLayouts().join(', ')})`
    );
  }
  const layout = await engine(model, options);
  return checkLayout(engineName, model, {
    edges: [],
    groups: [],
    ...layout,
  });
}
