import {
  checked,
  size,
  count,
  encode,
  linksAt,
  invalid,
} from './configuration-model.js';

function permutations(n) {
  const result = [];
  const visit = (prefix, rest) => {
    if (!rest.length) {
      result.push([0, ...prefix]);
    }
    for (let i = 0; i < rest.length; i++) {
      visit(
        [...prefix, rest[i]],
        rest.filter((_, j) => i !== j)
      );
    }
  };
  visit(
    [],
    Array.from({ length: n }, (_, i) => i + 1)
  );
  return result;
}

function renamed(links, p) {
  const result = Array(links.length);
  links.forEach((pair, i) => {
    result[p[i + 1] - 1] = pair.map((ref) => p[ref]);
  });
  return result;
}

/** permutation[i] is the new one-based name of old link i+1. */
export function relabel(links, permutation) {
  checked(links);
  if (
    permutation.length !== links.length ||
    new Set(permutation).size !== links.length ||
    permutation.some((v) => !Number.isInteger(v) || v < 1 || v > links.length)
  ) {
    invalid('name');
  }
  return renamed(links, [0, ...permutation]);
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < 2; j++) {
      if (a[i][j] !== b[i][j]) {
        return a[i][j] - b[i][j];
      }
    }
  }
  return 0;
}

/** Minimum in numeric counting order, practical through seven links. */
export function canonical(links) {
  checked(links);
  let best = links;
  for (const p of permutations(links.length)) {
    const candidate = renamed(links, p);
    if (compare(candidate, best) < 0) {
      best = candidate;
    }
  }
  return encode(best);
}

/** Orbit sieve: only expand unvisited representatives, using one expansion per class. */
export function representatives(n, { real = false } = {}) {
  size(n);
  const total = count(n, { real });
  // Arrays cannot represent more than 2^32-1 slots. Fail before rounding a count.
  if (total > 0xffffffffn) {
    throw new RangeError('Enumeration exceeds array capacity');
  }
  const visited = new Uint8Array(Number(total));
  const ps = permutations(n);
  const base = real ? n : n + 1;
  const powers = Array.from(
    { length: 2 * n },
    (_, i) => base ** (2 * n - 1 - i)
  );
  const result = [];
  for (let index = 0; index < visited.length; index++) {
    if (visited[index]) {
      continue;
    }
    const links = linksAt(n, index, { real });
    result.push(links);
    for (const p of ps) {
      let renamedIndex = 0;
      for (let i = 0; i < n; i++) {
        const offset = 2 * (p[i + 1] - 1);
        renamedIndex +=
          (p[links[i][0]] - (real ? 1 : 0)) * powers[offset] +
          (p[links[i][1]] - (real ? 1 : 0)) * powers[offset + 1];
      }
      visited[renamedIndex] = 1;
    }
  }
  return result;
}

/** Burnside over integer partitions (cycle types), with exact integer weights. */
export function classCount(n, { real = false } = {}) {
  size(n);
  let factorial = 1n;
  for (let i = 2; i <= n; i++) {
    factorial *= BigInt(i);
  }
  let sum = 0n;
  const visit = (remaining, min, cycles) => {
    if (remaining) {
      for (let length = min; length <= remaining; length++) {
        visit(remaining - length, length, [...cycles, length]);
      }
      return;
    }
    const multiplicities = new Map();
    for (const length of cycles) {
      multiplicities.set(length, (multiplicities.get(length) ?? 0) + 1);
    }
    let z = 1n;
    let fixed = 1n;
    for (const [length, m] of multiplicities) {
      z *= BigInt(length) ** BigInt(m);
      for (let i = 2; i <= m; i++) {
        z *= BigInt(i);
      }
    }
    for (const length of cycles) {
      const choices =
        (real ? 0 : 1) +
        cycles
          .filter((other) => length % other === 0)
          .reduce((a, b) => a + b, 0);
      fixed *= BigInt(choices) ** 2n;
    }
    sum += (factorial / z) * fixed;
  };
  visit(n, 1, []);
  return sum / factorial;
}
