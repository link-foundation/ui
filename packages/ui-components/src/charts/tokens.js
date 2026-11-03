/**
 * The colour tokens of the charts: the categorical series `color.chart.1`
 * ... `color.chart.8` and the chart text, axis, grid and background, in a
 * light and a dark mode. Each series colour has at least 3:1 contrast with
 * the background of its mode (WCAG 2.2 non-text contrast, 1.4.11) and the
 * text colours at least 4.5:1 (1.4.3); the tests check both.
 *
 * The renderers write `var(--color-chart-1, #1f6fb2)`, so a page restyles a
 * chart with the CSS custom properties of `@link-foundation/ui-tokens`
 * (`chartTokensLino()` is the theme), and a lone SVG still has its colours.
 */

/** The number of categorical series colours. */
export const SERIES_COUNT = 8;

/**
 * The token values of each mode. `background` is the surface the chart is
 * drawn on; `text` titles and labels; `muted` tick labels; `axis` axis
 * lines; `grid` the decorative grid lines; `focus` the focus ring.
 */
export const CHART_TOKENS = Object.freeze({
  light: Object.freeze({
    'color.chart.1': '#1f6fb2',
    'color.chart.2': '#c2410c',
    'color.chart.3': '#15803d',
    'color.chart.4': '#b91c5c',
    'color.chart.5': '#6d28d9',
    'color.chart.6': '#0e7490',
    'color.chart.7': '#a16207',
    'color.chart.8': '#4b5563',
    'color.chart.background': '#ffffff',
    'color.chart.text': '#1c1b1f',
    'color.chart.muted': '#5f6368',
    'color.chart.axis': '#5f6368',
    'color.chart.grid': '#e3e3e8',
    'color.chart.focus': '#1c1b1f',
  }),
  dark: Object.freeze({
    'color.chart.1': '#60a5fa',
    'color.chart.2': '#fb923c',
    'color.chart.3': '#4ade80',
    'color.chart.4': '#f472b6',
    'color.chart.5': '#a78bfa',
    'color.chart.6': '#22d3ee',
    'color.chart.7': '#facc15',
    'color.chart.8': '#9ca3af',
    'color.chart.background': '#141218',
    'color.chart.text': '#e6e1e5',
    'color.chart.muted': '#a8a3ad',
    'color.chart.axis': '#a8a3ad',
    'color.chart.grid': '#36343b',
    'color.chart.focus': '#e6e1e5',
  }),
});

/** The CSS custom property of a token path (`--color-chart-1`). */
export const tokenVariable = (path) => `--${path.split('.').join('-')}`;

/** The path of the series colour of a series index (0-based, cycling). */
export const seriesToken = (index) =>
  `color.chart.${(index % SERIES_COUNT) + 1}`;

/**
 * A colour of a token for a renderer: the literal value when `tokens`
 * gives one (an object or a Map of token path to colour), otherwise the
 * CSS custom property with the light value as fallback.
 * @param {string} path
 * @param {Record<string, string>|Map<string, string>|null} [tokens]
 */
export function tokenColor(path, tokens = null) {
  const value = tokens instanceof Map ? tokens.get(path) : tokens?.[path];
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return `var(${tokenVariable(path)}, ${CHART_TOKENS.light[path]})`;
}

/**
 * The chart tokens as a `@link-foundation/ui-tokens` theme in Links
 * Notation, with the dark values as `(mode dark ...)`.
 * @param {string} [name]  the theme name
 * @returns {string}
 */
export function chartTokensLino(name = 'charts') {
  const line = ([path, value]) => `(token ${path} '${value}')`;
  const light = Object.entries(CHART_TOKENS.light).map(
    (entry) => `  ${line(entry)}`
  );
  const dark = Object.entries(CHART_TOKENS.dark).map(
    (entry) => `    ${line(entry)}`
  );
  return `(${name}: theme\n${light.join('\n')}\n  (mode dark\n${dark.join('\n')}))\n`;
}

const declarations = (mode) =>
  Object.entries(CHART_TOKENS[mode])
    .map(([path, value]) => `${tokenVariable(path)}: ${value};`)
    .join(' ');

/**
 * The style sheet of the chart elements: the token custom properties (light,
 * dark by `prefers-color-scheme` or `data-theme="dark"`), the visually
 * hidden table twin, the tooltip and focus ring, and a fade that is off
 * under `prefers-reduced-motion`.
 */
export const CHART_CSS = `:root { ${declarations('light')} }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { ${declarations('dark')} }
}
[data-theme='dark'] { ${declarations('dark')} }
[data-theme='light'] { ${declarations('light')} }
.ui-chart, .ui-stat-tile, .ui-gauge, .ui-sparkline {
  color: var(--color-chart-text); background: var(--color-chart-background);
  font-family: system-ui, sans-serif; position: relative; display: block;
}
.ui-sparkline { display: inline-block; vertical-align: middle; }
.ui-chart svg, .ui-gauge svg { display: block; max-width: 100%; height: auto; }
.ui-chart-figure { margin: 0; }
.ui-chart-canvas { position: relative; border-radius: 4px; }
.ui-chart-canvas:focus { outline: none; }
.ui-chart-canvas:focus-visible {
  outline: 2px solid var(--color-chart-focus); outline-offset: 2px;
}
.ui-chart-summary { margin: 0.25rem 0; font-size: 0.875rem; color: var(--color-chart-muted); }
.ui-chart-toggle {
  font: inherit; font-size: 0.875rem; color: var(--color-chart-text);
  background: transparent; border: 1px solid var(--color-chart-axis);
  border-radius: 4px; padding: 0.25rem 0.75rem; cursor: pointer;
}
.ui-chart-toggle:focus-visible { outline: 2px solid var(--color-chart-focus); outline-offset: 2px; }
.ui-chart-table { border-collapse: collapse; margin-top: 0.5rem; font-size: 0.875rem; }
.ui-chart-table caption { text-align: start; font-weight: 600; padding-bottom: 0.25rem; }
.ui-chart-table th, .ui-chart-table td {
  border: 1px solid var(--color-chart-grid); padding: 0.25rem 0.5rem; text-align: start;
}
.ui-visually-hidden {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0;
}
.ui-chart-tooltip {
  position: absolute; pointer-events: none; z-index: 1; max-width: 16rem;
  background: var(--color-chart-text); color: var(--color-chart-background);
  border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.8125rem; line-height: 1.3;
  transform: translate(-50%, calc(-100% - 10px)); white-space: nowrap;
}
.ui-chart-tooltip[hidden] { display: none; }
.ui-chart-focus { fill: none; stroke: var(--color-chart-focus); stroke-width: 2; }
.ui-stat-tile { padding: 0.75rem 1rem; border: 1px solid var(--color-chart-grid); border-radius: 8px; min-width: 10rem; }
.ui-stat-tile-label { font-size: 0.875rem; color: var(--color-chart-muted); margin: 0; }
.ui-stat-tile-value { font-size: 1.75rem; font-weight: 600; margin: 0.125rem 0; }
.ui-stat-tile-delta { font-size: 0.875rem; margin: 0; }
.ui-gauge { width: max-content; }
@media (prefers-reduced-motion: no-preference) {
  .ui-chart svg, .ui-gauge svg, .ui-sparkline svg { animation: ui-chart-fade 200ms ease-out; }
}
@keyframes ui-chart-fade { from { opacity: 0; } to { opacity: 1; } }
`;
