/**
 * Actions are data, never code: a converter never evaluates anything it
 * reads, and URLs whose scheme runs code are not carried over.
 */

const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

/**
 * Whether a URL would run code when opened.
 * @param {unknown} url
 */
export function isUnsafeUrl(url) {
  let text = '';
  for (const c of String(url ?? '').toLowerCase()) {
    if (c > ' ') {
      text += c;
    }
  }
  return UNSAFE_SCHEMES.some((scheme) => text.startsWith(scheme));
}

/**
 * Whether a value is a plain JSON object.
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether an object key could reach the prototype of an object
 * (`__proto__`, `constructor` or `prototype`). Data paths that name one
 * are never followed or written.
 * @param {unknown} key
 */
export const isUnsafeKey = (key) =>
  key === '__proto__' || key === 'constructor' || key === 'prototype';
