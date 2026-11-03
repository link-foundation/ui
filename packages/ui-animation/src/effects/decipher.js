/**
 * The built-in `decipher` text effect: every non-space character starts as a
 * random glyph and is revealed, in a random order, as progress goes 0 -> 1.
 *
 * Ported from immortality `app/src/textEffects.ts` (Unlicense):
 * https://github.com/konard/immortality/blob/main/app/src/textEffects.ts
 * whose algorithm follows Arwes `animateTextDecipher` (MIT). The port
 * replaces the platform random generator with {@link seededRandom}: the
 * reveal order depends only on the seed, and the glyphs of a frame only on
 * the seed and the progress, so the same sample is always the same text.
 */

import { mix, seedNumber, seededRandom } from '../random.js';

export const DECIPHER_CHARACTERS =
  '    ----____abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Whitespace is kept as it is (no regular expression needed). */
const isWhitespace = (c) => c.trim() === '';

/**
 * The order in which character positions are revealed (a Fisher–Yates
 * shuffle of the non-whitespace positions).
 * @param {string} text
 * @param {() => number} random
 * @returns {number[]}
 */
export function revealOrder(text, random) {
  const indexes = [];
  for (let i = 0; i < text.length; i++) {
    if (!isWhitespace(text[i])) {
      indexes.push(i);
    }
  }
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

/**
 * The text at `progress` (0..1): revealed positions show the real
 * character, the others a random glyph; whitespace is kept.
 * @param {string} text
 * @param {number} progress
 * @param {readonly number[]} order
 * @param {() => number} random
 * @returns {string}
 */
export function decipherFrame(text, progress, order, random) {
  if (progress >= 1) {
    return text;
  }
  const count = Math.floor(Math.max(0, progress) * order.length);
  const revealed = new Set(order.slice(0, count));
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    out +=
      isWhitespace(c) || revealed.has(i)
        ? c
        : DECIPHER_CHARACTERS[
            Math.floor(random() * DECIPHER_CHARACTERS.length)
          ];
  }
  return out;
}

/**
 * The `decipher` effect: `(effect decipher (seed 42))`.
 * @param {string} input     the final text
 * @param {number} progress  0..1
 * @param {number|string} seed
 * @returns {string}
 */
export function decipher(input, progress, seed) {
  const text = String(input ?? '');
  const base = seedNumber(seed);
  const order = revealOrder(text, seededRandom(base));
  const frame = Math.round(Math.min(1, Math.max(0, progress)) * 1e6);
  return decipherFrame(text, progress, order, seededRandom(mix(base, frame)));
}
