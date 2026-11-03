/**
 * Shared JSDoc types of `@link-foundation/ui-tokens` (the same types are
 * declared for TypeScript in index.d.ts).
 */

/**
 * @typedef {import('@link-foundation/ui-core').Diagnostic} Diagnostic
 * @typedef {import('@link-foundation/ui-core').values.TypedValue} TypedValue
 */

/**
 * A token value: a ui-core typed value (`color`, `dimension`, `duration`,
 * `number`, `token-ref`) or one of the token types `fontFamily`,
 * `fontWeight`, `cubicBezier`, `shadow`, `typography`.
 * @typedef {TypedValue
 *   | { type: 'fontFamily', value: string|string[] }
 *   | { type: 'fontWeight', value: number|string }
 *   | { type: 'cubicBezier', value: number[] }
 *   | { type: 'shadow', value: object|object[] }
 *   | { type: 'typography', value: Record<string, TokenValue> }} TokenValue
 */

/**
 * @typedef {object} Token
 * @property {string} path  `color.on-primary`
 * @property {string} type  the declared type, or the type read from the
 *   value; `null` for an alias without `(type ...)`
 * @property {TokenValue} value  as written; an alias is a `token-ref`
 * @property {string} [sourceValue] original exchange value
 * @property {string} [fluent] original Fluent alias name
 * @property {string} [description]
 * @property {string} [mode]  the mode of a `(mode NAME ...)` token
 */

/**
 * @typedef {object} TokenSet
 * @property {string} id
 * @property {string[]} extends
 * @property {Token[]} tokens
 * @property {Record<string, Token[]>} modes
 */

/**
 * @typedef {object} ResolvedToken
 * @property {string} path
 * @property {string} type
 * @property {TokenValue} value  fully resolved: no alias left
 * @property {TokenValue} raw  as written, aliases kept
 * @property {string} [alias]  the path a whole-token alias points to
 * @property {string} [sourceValue] original exchange value
 * @property {string} [fluent] original Fluent alias name
 * @property {string} [description]
 * @property {string} set  the set that defines the token
 * @property {string} [mode]  the mode whose override defines the token
 */

/**
 * `Map<path, ResolvedToken>` in definition order, plus what the resolver
 * found out.
 * @typedef {Map<string, ResolvedToken> & {
 *   setId: string,
 *   mode: string|null,
 *   modes: Map<string, Map<string, ResolvedToken>>,
 *   diagnostics: Diagnostic[],
 * }} ResolvedTokens
 */

export {};
