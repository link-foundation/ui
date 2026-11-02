/**
 * Shared helpers of the ui-store tests. The samples and the seeded random
 * generator are the ones of the ui-core tests.
 */

export { samples, seededRandom, shape } from '../../ui-core/tests/helpers.js';

/** Every ID of a store in pre-order. */
export function allIds(store) {
  const out = [];
  const walk = (ids) => {
    for (const id of ids) {
      out.push(id);
      walk(store.children(id));
    }
  };
  walk(store.roots());
  return out;
}

/** @template T @param {() => number} rand @param {T[]} list @returns {T} */
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];

/** A random integer in `0..max`. */
export const upTo = (rand, max) => Math.floor(rand() * (max + 1));

/** `true` when `id` is `ancestor` or inside it. */
export function isInside(store, id, ancestor) {
  for (let p = id; p !== null; p = store.parentOf(p)) {
    if (p === ancestor) {
      return true;
    }
  }
  return false;
}

/** Every valid target of a move of `id`: `[parentId, maxIndex]` pairs. */
export function moveTargets(store, id) {
  return [null, ...allIds(store)]
    .filter((p) => p === null || !isInside(store, p, id))
    .map((p) => {
      const list = p === null ? store.roots() : store.children(p);
      return [p, list.length - (store.parentOf(id) === p ? 1 : 0)];
    });
}

/** A random node to insert; `n` makes its names unique. */
export function randomNode(rand, n) {
  const node = {
    id: rand() < 0.4 ? `n${n}` : null,
    kind: pick(rand, ['text', 'button', 'stack']),
    properties: [{ name: 'label', values: [`v${n}`] }],
  };
  if (rand() < 0.3) {
    node.children = [{ kind: 'text', positional: [`c${n}`] }];
  }
  return node;
}

const OPS = [
  'insert',
  'insert',
  'remove',
  'move',
  'setProp',
  'setProp',
  'removeProp',
  'rename',
];

/**
 * Apply one random valid operation through the public API.
 * @param {ReturnType<import('../src/index.js').createStore>} store
 * @param {() => number} rand
 * @param {number} n  the step number (keeps new names and values unique)
 */
export function randomOp(store, rand, n) {
  const ids = allIds(store);
  const kind = ids.length === 0 ? 'insert' : pick(rand, OPS);
  const id = pick(rand, ids);
  if (kind === 'insert') {
    const parentId = ids.length > 0 && rand() < 0.7 ? id : null;
    const size = (parentId === null ? store.roots() : store.children(id))
      .length;
    store.insert(parentId, upTo(rand, size), randomNode(rand, n));
  } else if (kind === 'remove') {
    store.remove(id);
  } else if (kind === 'move') {
    const [parentId, max] = pick(rand, moveTargets(store, id));
    store.move(id, parentId, upTo(rand, max));
  } else if (kind === 'setProp') {
    store.setProp(id, pick(rand, ['label', 'variant', 'gap']), [`s${n}`]);
  } else if (kind === 'removeProp' && store.get(id).properties.length > 0) {
    store.removeProp(id, pick(rand, store.get(id).properties).name);
  } else if (kind === 'rename') {
    store.rename(id, rand() < 0.5 ? `r${n}` : null);
  }
  return kind;
}

/** The `code` of the error `fn` throws, or `undefined` if it does not. */
export function errorCode(fn) {
  try {
    fn();
  } catch (error) {
    return error.code ?? error.name;
  }
  return undefined;
}

/** A store that records every listener call as `[events, entry]`. */
export function recorded(store) {
  const calls = [];
  store.subscribe((events, entry) => calls.push([events, entry]));
  return calls;
}
