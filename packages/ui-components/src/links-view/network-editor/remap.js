export function remapOptions(options, indexMap, count) {
  const remap = (key, fallback) => {
    const output = Array.from({ length: count }, () =>
      globalThis.structuredClone(fallback)
    );
    for (const [oldId, newId] of indexMap) {
      output[newId - 1] = globalThis.structuredClone(
        options[key][oldId - 1] ?? fallback
      );
    }
    return output;
  };
  return {
    turns: remap('turns', [0, 0]),
    linkGaps: remap('linkGaps', [null, null, null, null]),
    linkColors: remap('linkColors', null),
  };
}
export function canonicalMap(config, links, code) {
  function search(permutation, remaining) {
    if (!remaining.length) {
      return config.encode(config.relabel(links, permutation)) === code
        ? permutation
        : null;
    }
    for (const value of remaining) {
      const found = search(
        [...permutation, value],
        remaining.filter((v) => v !== value)
      );
      if (found) {
        return found;
      }
    }
    return null;
  }
  const permutation = search(
    [],
    links.map((_, i) => i + 1)
  );
  if (!permutation) {
    throw new Error('Canonical adapter returned an unrelated network');
  }
  return new Map(permutation.map((value, i) => [i + 1, value]));
}
