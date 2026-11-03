/**
 * Token resolution. ui-animation does not depend on ui-tokens: every
 * function takes a `resolveToken(path)` callback. It may return a ui-tokens
 * typed value (`{ type: 'duration', value: 150, unit: 'ms' }`), a resolved
 * ui-tokens entry (`{ path, type, value }`), a number (ms for durations) or
 * `undefined` when the token is unknown.
 */

/**
 * The typed value of what `resolveToken` returned (unwraps a ui-tokens
 * entry).
 * @param {unknown} token
 */
export function unwrapToken(token) {
  if (
    token !== null &&
    typeof token === 'object' &&
    Object.hasOwn(token, 'path') &&
    Object.hasOwn(token, 'value')
  ) {
    return token.value;
  }
  return token;
}

/**
 * A `resolveToken` callback over the map that ui-tokens `resolveTokens`
 * returns (path -> entry).
 * @param {Map<string, { value: unknown }>} tokens
 * @returns {(path: string) => unknown}
 */
export const tokenResolver = (tokens) => (path) => tokens.get(path)?.value;
