/**
 * Values for the LiNo backend are triplets too. Reserve a self-typed triplet
 * (r: r r r), three kind markers (r r 0), (r r r), (r 0 r), and a right
 * list (node: r tail bit-marker) of UTF-16 bits, terminated by r. A value
 * row is (row: kind owner text). Every reference participates in cascades.
 * Multiple namespaces are readable; independent writers may create one each.
 */
import { badDeepQuery } from './deep-query.js';

export const deepValueKinds = () => ['string', 'number', 'object'];

export function deepValueText(kind, value) {
  if (
    !deepValueKinds().includes(kind) ||
    (kind === 'number' && !Number.isFinite(value)) ||
    (kind === 'string' && typeof value !== 'string')
  ) {
    throw badDeepQuery(`Invalid ${kind} value`);
  }
  const text = kind === 'string' ? value : JSON.stringify(value);
  if (text === undefined) {
    throw badDeepQuery('A Deep value must be JSON serializable');
  }
  return text;
}

function namespaces(synced) {
  return synced
    .eachTriplet()
    .filter((t) => t.type === t.index && t.from === t.index && t.to === t.index)
    .map((root) => {
      const r = root.index;
      const find = (from, to) =>
        synced.eachTriplet({ type: r, from, to }).find((t) => t.index !== r)
          ?.index;
      return {
        root: r,
        string: find(r, 0),
        number: find(r, r),
        object: find(0, r),
      };
    })
    .filter((ns) => ns.string && ns.number && ns.object);
}

function readText(synced, ns, tail) {
  const bits = [],
    seen = new Set();
  while (tail !== ns.root) {
    if (seen.has(tail)) {
      throw badDeepQuery('Cyclic Deep value');
    }
    seen.add(tail);
    const node = synced.getTriplet(tail);
    if (
      !node ||
      node.type !== ns.root ||
      ![ns.string, ns.number].includes(node.to)
    ) {
      return undefined; // A partial cache may not yet contain its text.
    }
    bits.push(node.to === ns.number ? 1 : 0);
    tail = node.from;
  }
  if (bits.length % 16) {
    throw badDeepQuery('Incomplete UTF-16 Deep value');
  }
  bits.reverse();
  let text = '';
  for (let i = 0; i < bits.length; i += 16) {
    text += String.fromCharCode(
      bits.slice(i, i + 16).reduce((n, b) => n * 2 + b, 0)
    );
  }
  return text;
}

export function createDeepValues(synced) {
  const ensure = () => {
    const known = namespaces(synced)[0];
    if (known) {
      return known;
    }
    const root = synced.createTripletPoint();
    synced.updateTriplet(root, root, root, root);
    return {
      root,
      string: synced.createTriplet(root, root, 0),
      number: synced.createTriplet(root, root, root),
      object: synced.createTriplet(root, 0, root),
    };
  };
  const valueRows = () =>
    namespaces(synced).flatMap((ns) =>
      deepValueKinds().flatMap((kind) =>
        synced.eachTriplet({ type: ns[kind] }).map((row) => ({ row, ns, kind }))
      )
    );
  return {
    read() {
      const spaces = namespaces(synced);
      const hidden = new Set(spaces.flatMap((ns) => Object.values(ns)));
      const values = new Map();
      for (const ns of spaces) {
        synced
          .eachTriplet({ type: ns.root })
          .forEach((t) => hidden.add(t.index));
      }
      for (const { row, ns, kind } of valueRows()) {
        hidden.add(row.index);
        const text = readText(synced, ns, row.to);
        if (text !== undefined) {
          const value = kind === 'string' ? text : JSON.parse(text);
          const owner = values.get(row.from) ?? {};
          owner[kind] = { id: row.index, link_id: row.from, value };
          values.set(row.from, owner);
        }
      }
      return { hidden, values };
    },
    set(owner, kind, value) {
      const text = deepValueText(kind, value);
      const ns = ensure();
      let tail = ns.root;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        for (let bit = 15; bit >= 0; bit--) {
          const to = code & (1 << bit) ? ns.number : ns.string;
          tail =
            synced
              .eachTriplet({ type: ns.root, from: tail, to })
              .find((t) => t.index !== ns.root && t.index !== ns.number)
              ?.index ?? synced.createTriplet(ns.root, tail, to);
        }
      }
      const existing = valueRows().find(
        (entry) =>
          entry.row.from === synced.resolve(owner) && entry.kind === kind
      );
      if (existing) {
        synced.updateTriplet(
          existing.row.index,
          existing.ns[kind],
          owner,
          tail
        );
        return existing.row.index;
      }
      return synced.createTriplet(ns[kind], owner, tail);
    },
    remove(owner, kind) {
      for (const entry of valueRows().filter(
        (entry) =>
          entry.row.from === synced.resolve(owner) && entry.kind === kind
      )) {
        synced.deleteTriplet(entry.row.index);
      }
    },
  };
}
