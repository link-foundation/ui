/**
 * `sampleLayers(layers, tMs)`: several animations on one element, combined
 * bottom to top by their `composite`:
 * - `replace` (the default): the layer's value replaces the value below;
 * - `add` and `accumulate`: the layer's value is added to the value below
 *   (number by number for texts with the same skeleton); `scale` combines
 *   by multiplication, so `(composite add)` of scale 1.1 over 0.9 is 0.99.
 * A layer with an `(envelope ...)` is weighted by it (see `sample`), so a
 * bell-shaped glow fades in and out over whatever is below it.
 */

import { sampleTyped } from './sample.js';
import { outputValue } from './values.js';

const isQuantity = (part) => typeof part === 'object';

/** Combine an additive value `top` onto `under`, or `null` when they can't. */
function combine(property, under, top) {
  const op = property === 'scale' ? (a, b) => a * b : (a, b) => a + b;
  if (under.type === 'number' && top.type === 'number') {
    return { type: 'number', value: op(under.value, top.value) };
  }
  if (
    under.type === 'text' &&
    top.type === 'text' &&
    under.parts.length === top.parts.length
  ) {
    const parts = [];
    for (let i = 0; i < under.parts.length; i++) {
      const a = under.parts[i];
      const b = top.parts[i];
      if (isQuantity(a) && isQuantity(b)) {
        if (a.unit !== b.unit && a.unit !== '' && b.unit !== '') {
          return null;
        }
        parts.push({ value: op(a.value, b.value), unit: a.unit || b.unit });
      } else if (a === b) {
        parts.push(a);
      } else {
        return null;
      }
    }
    return { type: 'text', parts };
  }
  return null;
}

/** A layer or a bare animation as `{ animation, start, seed, input }`. */
function asLayer(layer) {
  if (layer && Object.hasOwn(layer, 'animation')) {
    return { ...layer, start: layer.start ?? 0 };
  }
  return { animation: layer, start: 0 };
}

/**
 * The combined values of animation layers at `tMs`. A layer is an animation
 * or `{ animation, start, seed, input }` (`start`: when it starts, ms).
 * @param {(import('./types.js').Animation | import('./types.js').Layer)[]} layers
 * @param {number} tMs
 * @param {import('./types.js').SampleOptions} [options]
 * @returns {Record<string, number|string|unknown>}
 */
export function sampleLayers(layers, tMs, options = {}) {
  const values = new Map();
  const effects = {};
  for (const layer of layers.map(asLayer)) {
    const { animation } = layer;
    const result = sampleTyped(animation, tMs - layer.start, {
      ...options,
      seed: layer.seed ?? options.seed,
      input: layer.input ?? options.input,
    });
    const additive = animation.composite && animation.composite !== 'replace';
    for (const [property, value] of result.values) {
      const under = values.get(property);
      const combined =
        additive && under ? combine(property, under, value) : null;
      values.set(property, combined ?? value);
    }
    Object.assign(effects, result.effects);
  }
  const out = {};
  for (const [property, value] of values) {
    out[property] = outputValue(value);
  }
  return Object.assign(out, effects);
}
