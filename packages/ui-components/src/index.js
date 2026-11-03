/**
 * `@link-foundation/ui-components`: components of the associative UI
 * framework, each in its own folder and also exported on its own:
 *
 * - `./behavior`: behaviour state machines written in Links Notation with a
 *   DOM-free interpreter and an actions registry (the ui-dom integration is
 *   `./behavior/dom`);
 * - `./a11y`: DOM accessibility helpers;
 * - `./diagrams`: a diagram written in Links Notation, laid out by Dagre,
 *   drawn as accessible SVG or by a lazily loaded Mermaid adapter;
 * - `./links-view`: `link-view`, one link drawn from links-visuals geometry.
 *
 * See README.md.
 */

export * from './behavior/index.js';
export * from './a11y/index.js';
export * from './diagrams/index.js';
export * from './links-view/index.js';
