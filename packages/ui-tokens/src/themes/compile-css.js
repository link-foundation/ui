import { values } from '@link-foundation/ui-core';
import { compileCss } from '@link-foundation/ui-style';
import { toCss } from '../export/css.js';
import { cssVariable } from '../names.js';
import { resolveTokens } from '../resolve.js';
import { resolveThemeTokens, themeDiagnostic } from './model.js';
import { contrastRatio, ensureContrast } from './contrast.js';

const colorPair = (fg, bg) => fg?.type === 'color' && bg?.type === 'color';

/** Check every pair after aliases and all active modes have resolved. */
export function checkedTokens(theme, modes, options = {}) {
  let tokens = resolveThemeTokens(theme, modes);
  const report = (d) => {
    options.diagnostics?.push(d);
    options.onDiagnostic?.(d);
  };
  tokens.diagnostics.forEach(report);
  for (const [on, fill] of theme.pairs) {
    const fg = tokens.get(on),
      bg = tokens.get(fill);
    if (!colorPair(fg, bg)) {
      report(
        themeDiagnostic(
          'invalid-pair',
          'error',
          'Pair must reference two color tokens',
          { theme: theme.id, on, fill, modes }
        )
      );
      continue;
    }
    const result = ensureContrast(
      fg.value,
      bg.value,
      options.minContrast ?? 4.5
    );
    if (result.adjusted) {
      const value = values.parseColor(result.color);
      tokens.set(fill, { ...bg, raw: value, value });
      // Reuse the token resolver so direct, chained and composite aliases all
      // see the corrected fill before checking subsequent pairs or exporting.
      tokens = resolveTokens(
        new Map([
          [
            theme.id,
            {
              id: theme.id,
              extends: [],
              modes: {},
              tokens: [...tokens.values()].map((token) => ({
                ...token,
                value: token.raw,
              })),
            },
          ],
        ]),
        theme.id
      );
      report(
        themeDiagnostic(
          'contrast-adjusted',
          options.strict ? 'error' : 'warning',
          'Adjusted filled accent to meet contrast',
          { theme: theme.id, on, fill, modes, ratio: result.ratio }
        )
      );
    }
  }
  // A later correction can affect an earlier pair through an alias. Check
  // the final output too, including conflicting pairs that cannot be met.
  for (const [on, fill] of theme.pairs) {
    const fg = tokens.get(on),
      bg = tokens.get(fill);
    if (!colorPair(fg, bg)) {
      continue;
    }
    const ratio = contrastRatio(fg.value, bg.value);
    if (ratio < (options.minContrast ?? 4.5)) {
      report(
        themeDiagnostic(
          'contrast-unreachable',
          'error',
          'The declared foreground cannot reach the requested contrast',
          { theme: theme.id, on, fill, modes, ratio }
        )
      );
    }
  }
  // Emit resolved values, so adjustments and nested mode resets cannot leave stale aliases.
  return new Map(
    [...tokens].map(([path, t]) => [path, { ...t, raw: t.value }])
  );
}

/** Escaped attribute strings, including the HTML raw-text closing delimiter. */
const quoted = (text) =>
  `"${[...String(text)].map((c) => (/["\\<>\n\r\f]/u.test(c) ? `\\${c.codePointAt(0).toString(16)} ` : c)).join('')}"`;
const attr = (name, value) => `[data-${name}=${quoted(value)}]`;
const axis = (name, normal, active, feature, queryValue) => [
  {
    selector: `:is(${attr(name, normal)},:not([data-${name}]))`,
    mode: null,
    query: null,
  },
  { selector: attr(name, active), mode: active, query: null },
  {
    selector: attr(name, 'system'),
    mode: null,
    query: `not all and (${feature}: ${queryValue})`,
  },
  {
    selector: attr(name, 'system'),
    mode: active,
    query: `(${feature}: ${queryValue})`,
  },
];
// Each query nests separately: conjunctions of `not all` are not valid CSS media lists.
const media = (css, queries) =>
  queries.reduceRight((body, query) => `@media ${query} {\n${body}\n}`, css);

/** Scoped tokens for every explicit/system combination. No inherited dark residue. */
export function compileThemeCss(theme, options = {}) {
  const root = attr('theme', theme.id);
  const axes = [
    axis('scheme', 'light', 'dark', 'prefers-color-scheme', 'dark'),
    axis('contrast', 'normal', 'more', 'prefers-contrast', 'more'),
    axis('motion', 'full', 'reduced', 'prefers-reduced-motion', 'reduce'),
  ];
  const cache = new Map();
  const css = [];
  // A boundary with only data-theme still gets the light defaults.
  const base = checkedTokens(theme, [], options);
  cache.set('', base);
  css.push(toCss(base, { selector: root, prefix: options.prefix }));
  for (const scheme of axes[0]) {
    for (const contrast of axes[1]) {
      for (const motion of axes[2]) {
        const modes = [
          scheme.mode,
          contrast.mode === 'more' ? 'high-contrast' : null,
          motion.mode,
        ].filter(Boolean);
        const key = modes.join('/');
        if (!cache.has(key)) {
          cache.set(key, checkedTokens(theme, modes, options));
        }
        const selector = `${
          root
        }:where(${scheme.selector}${contrast.selector}${motion.selector})`;
        const block = toCss(cache.get(key), {
          selector,
          prefix: options.prefix,
        });
        css.push(
          media(
            block,
            [scheme.query, contrast.query, motion.query].filter(Boolean)
          )
        );
      }
    }
  }
  const forced = new Map([
    ['color.surface', 'Canvas'],
    ['color.on-surface', 'CanvasText'],
    ['color.on-surface-variant', 'CanvasText'],
    ['color.primary', 'Highlight'],
    ['color.on-primary', 'HighlightText'],
    ['color.button-text', 'ButtonText'],
  ]);
  css.push(
    `@media (forced-colors: active) {\n${root} {\n${[...forced].map(([path, value]) => `  ${cssVariable(path, options.prefix)}: ${value};`).join('\n')}\n}\n}`
  );
  // @scope's lower boundary stops an outer theme's style rules at nested themes.
  const style = compileCss(theme.styles, {
    prefix: options.prefix,
    scope: ':scope',
  });
  if (style) {
    css.push(`@scope (${root}) to ([data-theme]) {\n${style}\n}`);
  }
  return css.join('\n');
}
