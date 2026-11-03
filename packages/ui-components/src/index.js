/**
 * `@link-foundation/ui-components`: behaviour state machines written in
 * Links Notation with a DOM-free interpreter and an actions registry
 * (`./behavior`), DOM accessibility helpers (`./a11y`), charts (`./charts`;
 * the ECharts adapter is `./charts/echarts`), diagrams (`./diagrams`): a
 * diagram written in Links Notation, laid out by Dagre, drawn as accessible
 * SVG or by a lazily loaded Mermaid adapter, and icons (`./icons`: the own
 * CC0-1.0 set, the icon registry and `ui-icon`; the icon set adapters are
 * `./icons/adapters/<set>`). The ui-dom integration is `./behavior/dom`.
 * See README.md.
 */

export * from './behavior/index.js';
export * from './a11y/index.js';
export * from './charts/index.js';
export * from './diagrams/index.js';
export * from './icons/index.js';
