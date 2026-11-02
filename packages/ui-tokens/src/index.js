/**
 * @link-foundation/ui-tokens: design tokens written in Links Notation,
 * resolved (extends, modes, aliases) and written as CSS custom properties,
 * DTCG 2025.10 JSON, SwiftUI and Jetpack Compose constants.
 *
 * ```js
 * import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';
 *
 * const { sets } = readTokens(text);
 * const resolved = resolveTokens(sets, 'material3', { mode: null });
 * toCss(resolved); // ':root {\n  --color-primary: #6750a4;\n ...'
 * ```
 */

export { readTokens, isTokenPath } from './model.js';
export { resolveTokens } from './resolve.js';
export { toCss } from './export/css.js';
export { toDtcg, DTCG_EXTENSION } from './export/dtcg.js';
export { fromDtcg } from './import/dtcg.js';
export { toSwift } from './export/swift.js';
export { toKotlin } from './export/kotlin.js';
export { cssVariable } from './names.js';
export {
  TOKEN_TYPES,
  FONT_WEIGHTS,
  DIMENSION_UNITS,
  COMPOSITE_FIELDS,
  typeTokenValue,
  tokenValueRaw,
} from './values.js';
