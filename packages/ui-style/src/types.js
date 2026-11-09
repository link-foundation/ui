/**
 * JSDoc types of `@link-foundation/ui-style` (the same types as
 * src/index.d.ts).
 *
 * @typedef {import('@link-foundation/ui-core').Diagnostic} Diagnostic
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 * @typedef {import('@link-foundation/ui-core').values.TypedValue} TypedValue
 *
 * @typedef {'hover'|'focus'|'pressed'|'active'|'disabled'|'selected'|'checked'} StateName
 *
 * @typedef {object} Selector
 * @property {string|null} type   the element kind, `(type button)`
 * @property {string|null} id     the element id, `(id ok)`
 * @property {Array<{ name: string, value: string }>} props  `(variant filled)`
 * @property {Selector[]} within  ancestors, `(within (type dialog))`
 *
 * @typedef {object} Decl
 * @property {string} property  the style property, `background`
 * @property {TypedValue} value  typed; several values are a `list`
 *
 * @typedef {object} Condition
 * @property {string} feature  `max-width`, `prefers-color-scheme`, ...
 * @property {TypedValue} value  a dimension or an `enum`
 *
 * @typedef {object} Block
 * @property {'state'|'media'|'container'} kind
 * @property {StateName|Condition[]} condition  a state name, or the
 *   conditions of a media or container block (all must hold)
 * @property {StyleRule} rule  the declarations and blocks inside
 *
 * @typedef {object} StyleRule
 * @property {string} id
 * @property {number} order  the position of the rule in the input
 * @property {Selector} selector
 * @property {Decl[]} declarations
 * @property {Block[]} blocks
 *
 * @typedef {object} Entry  one rule or block flattened for the cascade
 * @property {string} id
 * @property {number} index  the position in the flattened (CSS) order
 * @property {Selector} selector
 * @property {StateName[]} states
 * @property {Array<{ kind: 'media'|'container', conditions: Condition[] }>} at
 * @property {Decl[]} declarations
 *
 * @typedef {object} StyleEnv
 * @property {string[]} [states]
 * @property {{ width: number }} [viewport]
 * @property {{ width: number }} [container]
 * @property {'light'|'dark'} [colorScheme]
 * @property {boolean} [reducedMotion]
 */

export {};
