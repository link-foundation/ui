/** Action calls in document order, including multiple calls on one event. */
export function nodeActions(node) {
  return node.properties
    .filter((p) => p.name === 'on')
    .flatMap(({ values }) =>
      values
        .slice(1)
        .filter(Array.isArray)
        .filter((call) => typeof call[0] === 'string')
        .map(([name, ...args]) => ({ event: values[0], name, args }))
    );
}

/** Collect distinct calls without mutating the core tree. */
export function collectActions(tree) {
  const seen = new Set();
  const actions = [];
  const visit = (node) => {
    for (const { name, args } of nodeActions(node)) {
      const key = JSON.stringify([name, args]);
      if (!seen.has(key)) {
        seen.add(key);
        actions.push({ name, args });
      }
    }
    node.children.forEach(visit);
  };
  tree.roots.forEach(visit);
  return actions;
}
