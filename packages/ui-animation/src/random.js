/**
 * Seeded pseudo-random numbers. Every random choice of ui-animation goes
 * through {@link seededRandom}, so a sample at a time and a seed is always the
 * same value: the package never calls the platform random generator.
 */

/**
 * A 32-bit unsigned seed from a number or a string. Numbers are truncated to
 * 32 bits; strings are hashed with FNV-1a.
 * @param {number|string} seed
 * @returns {number}
 */
export function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0;
  }
  return hashString(String(seed));
}

/** FNV-1a over the UTF-16 code units of `text`, 32-bit unsigned. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Mix several 32-bit integers into one (a small avalanche hash), for
 * per-frame randomness that depends only on its inputs.
 * @param {...number} parts
 * @returns {number}
 */
export function mix(...parts) {
  let h = 0x9e3779b9;
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/**
 * A deterministic generator of numbers in [0, 1) (mulberry32): the same seed
 * always gives the same sequence.
 * @param {number|string} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let state = seedNumber(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
