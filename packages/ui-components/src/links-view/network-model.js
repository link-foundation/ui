/** A network keeps link IDs distinct from implicit endpoint point IDs. */
export function buildNetwork(input) {
  const links = new Map();
  for (const value of input) {
    if (value.id === 0 || value.id === '0' || links.has(value.id)) {
      throw new TypeError(`Duplicate or reserved link ID: ${value.id}`);
    }
    links.set(value.id, {
      ...value,
      source: free(value.source),
      target: free(value.target),
    });
  }
  const points = new Map();
  for (const link of links.values()) {
    for (const id of [link.source, link.target]) {
      if (id !== 0 && !links.has(id)) {
        points.set(id, { id });
      }
    }
  }
  return { points, links };
}

const free = (id) => (id === null || id === undefined || id === '0' ? 0 : id);

/** All layout vertices, including the centre anchor of every link. */
export function networkIds(network) {
  const ids = new Set();
  for (const link of network.links.values()) {
    if (network.points.has(link.source)) {
      ids.add(link.source);
    }
    ids.add(link.id);
    if (network.points.has(link.target)) {
      ids.add(link.target);
    }
  }
  return [...ids];
}

/** Incidence edges: links are also vertices, allowing cycles and self-reference. */
export function networkEdges(network) {
  const edges = [];
  for (const link of network.links.values()) {
    for (const end of ['source', 'target']) {
      if (link[end] !== 0) {
        edges.push({ source: link.id, target: link[end] });
      }
    }
  }
  return edges;
}

/** Immediate neighbours in the incidence graph, stable in input order. */
export function networkNeighbours(network, id) {
  const neighbours = new Set();
  for (const edge of networkEdges(network)) {
    if (edge.source === id) {
      neighbours.add(edge.target);
    }
    if (edge.target === id) {
      neighbours.add(edge.source);
    }
  }
  neighbours.delete(id);
  return [...neighbours];
}
