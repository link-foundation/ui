/**
 * Shared JSDoc types of `@link-foundation/ui-animation` (the same types are
 * declared for TypeScript in index.d.ts).
 */

/**
 * @typedef {import('@link-foundation/ui-core').Diagnostic} Diagnostic
 */

/**
 * A time: milliseconds, or a `(token PATH)` resolved by `resolveToken`.
 * @typedef {number | { type: 'token', path: string }} Time
 */

/**
 * @typedef {{ type: 'linear' }
 *   | { type: 'named', name: string }
 *   | { type: 'cubic-bezier', points: number[] }
 *   | { type: 'steps', count: number, position: 'start'|'end'|'both'|'none' }
 *   | { type: 'spring', stiffness: number, damping: number, mass: number }} Easing
 */

/**
 * A key value as written: a number, a colour, a text of quantities
 * (`'0 8px'`) or a token reference.
 * @typedef {{ type: 'number', value: number }
 *   | { type: 'color', color: object }
 *   | { type: 'text', parts: (string|{ value: number, unit: string })[] }
 *   | { type: 'token', path: string }} AnimValue
 */

/**
 * @typedef {object} Key
 * @property {number} offset  0..1
 * @property {AnimValue} value
 * @property {Easing|null} easing  of the segment that starts at this key; null inherits animation easing
 */

/**
 * @typedef {object} Track
 * @property {string} property  a CSS property, or `text`, `label`, ...
 * @property {Key[]} keys
 */

/**
 * @typedef {object} Animation
 * @property {string} id
 * @property {'animation'} kind
 * @property {string|null} target
 * @property {Time|null} duration
 * @property {Time} delay
 * @property {number} iterations  `Infinity` for `infinite`
 * @property {'normal'|'reverse'|'alternate'|'alternate-reverse'} direction
 * @property {'none'|'forwards'|'backwards'|'both'|'auto'} fill
 * @property {'replace'|'add'|'accumulate'} composite
 * @property {Easing|null} easing
 * @property {Track[]} tracks
 * @property {{ name: string, params: Record<string, unknown> }|null} effect
 * @property {boolean} persist
 * @property {'bell'|'sustain'|null} envelope
 * @property {string[]} triggers  the states of `(on STATE)`
 * @property {Partial<Animation>|null} reducedMotion
 */

/**
 * @typedef {object} AnimationModel
 * @property {Map<string, Animation>} animations
 * @property {Map<string, { id: string, kind: 'timeline', items: object[] }>} timelines
 * @property {{ state: string, element: string, animation: string, target: string|null }[]} triggers
 * @property {Diagnostic[]} diagnostics
 */

/**
 * @typedef {object} SampleOptions
 * @property {(path: string) => unknown} [resolveToken]
 * @property {number|string} [seed]  the seed of effects without `(seed ...)`
 * @property {string} [input]  the text an effect works on
 */

/**
 * @typedef {object} Layer
 * @property {Animation} animation
 * @property {number} [start]
 * @property {number|string} [seed]
 * @property {string} [input]
 */

/**
 * @typedef {object} ValidateOptions
 * @property {(path: string) => unknown} [resolveToken]
 * @property {Partial<typeof import('./validate.js').FLASH_LIMITS>} [flash]
 */

/**
 * @typedef {object} PlayOptions
 * @property {string} [target]
 * @property {number|string} [seed]
 * @property {string} [input]
 */

/**
 * Where the player finds elements: a ui-dom render handle (`nodeFor`), a
 * function of an ID, or nothing (`document.getElementById`).
 * @typedef {{ nodeFor: (id: string) => Element|null }
 *   | ((id: string) => Element|null) | null | undefined} ElementSource
 */

/**
 * @typedef {object} PlayerOptions
 * @property {string|AnimationModel} [animations]
 * @property {object} [clock]  `{ now, requestFrame, cancelFrame }`
 * @property {'full'|'reduced'|((element: Element|null) => 'full'|'reduced')} [motion]
 * @property {(element: Element, keyframes: object[], options: object) => Animation} [animate]
 * @property {(path: string) => unknown} [resolveToken]
 * @property {number|string} [seed]
 * @property {(property: string) => boolean} [isCssProperty]
 * @property {(element: Element, property: string, value: unknown) => void} [apply]
 */

/**
 * @typedef {object} Player
 * @property {(listener: (event: object) => void) => () => void} subscribe
 * @property {AnimationModel} model
 * @property {(source: string|AnimationModel) => AnimationModel} load
 * @property {(id: string, options?: PlayOptions) => object} play
 * @property {(store: object) => () => void} bindTriggers
 * @property {(id: string) => 'full'|'reduced'} motion
 */

export {};
