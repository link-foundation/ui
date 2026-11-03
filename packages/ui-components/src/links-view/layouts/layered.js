import { layoutDiagram } from '../../diagrams/layout-dagre.js';
import { networkIds, networkEdges } from '../network-model.js';
import { regular } from './regular.js';

/** Use the same Dagre implementation as the diagrams component (#40). */
export function layered(network, options = {}) {
  const nodes = networkIds(network).map((id) => ({
    id: String(id),
    label: String(id),
    shape: 'circle',
    group: null,
  }));
  if (!nodes.length) {
    return new Map();
  }
  const edges = networkEdges(network).map((edge, i) => ({
    id: String(i),
    from: String(edge.source),
    to: String(edge.target),
    label: null,
  }));
  const layout = layoutDiagram({
    nodes,
    edges,
    groups: [],
    direction: 'right',
  });
  return regular(network, options, (i) => layout.nodes[i]);
}
