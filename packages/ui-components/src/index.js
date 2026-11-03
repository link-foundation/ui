/**
 * `@link-foundation/ui-components`: behaviour state machines written in
 * Links Notation with a DOM-free interpreter and an actions registry
 * (`./behavior`), DOM accessibility helpers (`./a11y`), diagrams
 * (`./diagrams`): a diagram written in Links Notation, laid out by Dagre,
 * drawn as accessible SVG or by a lazily loaded Mermaid adapter, and the
 * layout elements rendered by ui-dom (`./layout`, which registers its kinds
 * when imported). The ui-dom integration of behaviours is `./behavior/dom`.
 * See README.md.
 */

export * from './behavior/index.js';
export * from './a11y/index.js';
export * from './diagrams/index.js';
export * from './layout/index.js';
