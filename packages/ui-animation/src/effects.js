/**
 * The effect registry: effects compute a non-CSS value (such as the text of
 * an element) from progress 0..1, a seed and the effect parameters. The
 * player runs them in its clock-driven frame loop; `sample` runs them too.
 *
 * An effect must be pure: the same input, progress, seed and parameters give
 * the same output. Use `seededRandom(seed)` for randomness.
 */

import { decipher } from './effects/decipher.js';

/**
 * @typedef {(input: unknown, progress: number, seed: number|string,
 *   params: Record<string, number|string>) => unknown} EffectFn
 * @typedef {{ name: string, fn: EffectFn, property: string }} EffectEntry
 */

/** @type {Map<string, EffectEntry>} */
const registry = new Map();

/**
 * Register (or replace) an effect.
 * @param {string} name
 * @param {EffectFn} fn
 * @param {{ property?: string }} [options]  the element property it drives
 *   (default `text`)
 */
export function registerEffect(name, fn, { property = 'text' } = {}) {
  if (typeof name !== 'string' || name === '' || typeof fn !== 'function') {
    throw new TypeError('registerEffect(name, fn) needs a name and a function');
  }
  registry.set(name, { name, fn, property });
}

/**
 * @param {string} name
 * @returns {EffectEntry|undefined}
 */
export const getEffect = (name) => registry.get(name);

/** The names of the registered effects. */
export const effectNames = () => [...registry.keys()];

registerEffect('decipher', decipher);
