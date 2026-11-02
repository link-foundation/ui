/**
 * JSDoc types of the value layer (#15). This module has no runtime code; the
 * same types are declared for TypeScript in src/index.d.ts.
 *
 * @typedef {{ type: 'color', space: 'srgb', r: number, g: number, b: number, a: number }} SrgbColor
 *   sRGB, gamma-encoded, every channel 0..1 (`#FFFFFF` is r = g = b = 1).
 * @typedef {{ type: 'color', space: 'oklch', l: number, c: number, h: number, a: number }} OklchColor
 *   OKLCH: lightness 0..1, chroma, hue in degrees, alpha 0..1.
 * @typedef {SrgbColor | OklchColor} Color
 *
 * @typedef {{ type: 'dimension', value: number, unit: 'px'|'rem'|'em'|'%'|'vw'|'vh'|'' }
 *   | { type: 'duration', value: number, unit: 'ms'|'s' }
 *   | Color
 *   | { type: 'token-ref', path: string }
 *   | { type: 'element-ref', id: string }
 *   | { type: 'param', path: string }
 *   | { type: 'action', name: string, args: TypedValue[] }
 *   | { type: 'fallback', options: TypedValue[] }
 *   | { type: 'string'|'enum'|'url', value: string }
 *   | { type: 'number', value: number }
 *   | { type: 'boolean', value: boolean }
 *   | { type: 'list', items: TypedValue[], id?: string }} TypedValue
 *   A dimension written as a bare `0` has the empty unit `''`. A `list` is a
 *   nested link that no type describes (only from `inferValue` and `any`).
 *
 * @typedef {string | (string|string[])[]} ValueType
 *   A property type of docs/spec/vocabulary.lino: `dimension`,
 *   `['enum', 'filled', 'outlined', 'text']`, ...
 *
 * @typedef {object} ValueSpec
 * @property {ValueType} type      what `typeValue` expects
 * @property {boolean} [multi]     ignored by `typeValue` (a property spec)
 *
 * @typedef {object} TypeOptions
 * @property {import('../types.js').Vocabulary} [vocabulary]
 *   types the arguments of known actions (default: the ui-dialect/0 one)
 * @property {import('../types.js').DiagnosticLocation} [at]
 *   where diagnostics point (`{ element, property }`)
 *
 * @typedef {object} TypedResult
 * @property {TypedValue|null} value  `null` when the value is invalid
 * @property {import('../types.js').Diagnostic[]} diagnostics
 *
 * @typedef {import('../types.js').UiProperty & { typed: (TypedValue|null)[] }} TypedUiProperty
 *
 * @typedef {object} TypedUiNode
 * @property {string|null} id
 * @property {string|null} kind
 * @property {import('../types.js').RawValue[]} positional
 * @property {(TypedValue|null)[]} typedPositional  typed like the positional properties
 * @property {TypedUiProperty[]} properties
 * @property {TypedUiNode[]} children
 * @property {import('../types.js').RawValue[]} unknown
 *
 * @typedef {object} CssOptions
 * @property {(ref: TypedValue, fallback?: string) => string} [refToVar]
 *   CSS for a `token-ref` or `param`; default `var(--color-primary)` and
 *   `var(--param-draft-text)`, with the fallback as the second argument of
 *   `var()`.
 */

export {};
