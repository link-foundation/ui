/**
 * `@link-foundation/ui-components`: components of the associative UI
 * framework, each in its own folder and also exported on its own:
 *
 * - `./behavior`: behaviour state machines written in Links Notation with a
 *   DOM-free interpreter and an actions registry (the ui-dom integration is
 *   `./behavior/dom`);
 * - `./a11y`: DOM accessibility helpers;
 * - `./charts`: charts drawn as deterministic SVG (the ECharts adapter is
 *   `./charts/echarts`);
 * - `./diagrams`: a diagram written in Links Notation, laid out by Dagre,
 *   drawn as accessible SVG or by a lazily loaded Mermaid adapter;
 * - `./layout`: the layout elements rendered by ui-dom (it registers its
 *   kinds when imported);
 * - `./icons`: the own CC0-1.0 set, the icon registry and `ui-icon` (the
 *   icon set adapters are `./icons/adapters/<set>`);
 * - `./links-view`: `link-view`, one link drawn from links-visuals geometry;
 * - `./controls`: the basic controls (button, text field, checkbox, select,
 *   ...) rendered by ui-dom, their stories and catalog (`./controls.css`
 *   styles them).
 *
 * See README.md.
 */

export * from './behavior/index.js';
export * from './a11y/index.js';
export * from './charts/index.js';
export * from './diagrams/index.js';
export * from './layout/index.js';
export * from './links-view/index.js';
export * from './icons/index.js';
export * from './overlays/index.js';
export * from './controls/index.js';
