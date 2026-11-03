/** Theme packages are data. Token inheritance and aliases use the token resolver. */
import { parseNested, formatLinks } from '@link-foundation/ui-core';
import { readStyles } from '@link-foundation/ui-style';
import { readTokens, isTokenPath } from '../model.js';
import { resolveTokens, chainOf } from '../resolve.js';
import { readTemplate } from './templates.js';
import { isSpringToken, readSpring } from './springs.js';

export const themeDiagnostic = (code, severity, message, at = {}) => ({
  code,
  severity,
  message,
  at,
});
const head = (link) => link.values[0]?.id;
const raw = (link) =>
  link.values.length === 0 ? link.id : link.values.map(raw);
const values = (tokens) =>
  new Map([...tokens].map(([path, token]) => [path, token.value]));
const systemColors = new Set([
  'Canvas',
  'CanvasText',
  'Highlight',
  'HighlightText',
  'GrayText',
  'ButtonText',
  'ButtonFace',
]);
const defaults = new Set(['motion', 'sound', 'volume', 'transparency']);

/** Inspect every value, including nested template/style links, before interpreting it. */
function safe(link, diagnostics, id) {
  let ok = true;
  if (
    head(link) === 'script' ||
    (link.values.length === 0 && link.id === 'script') ||
    (typeof link.id === 'string' && /javascript:|expression\(/iu.test(link.id))
  ) {
    diagnostics.push(
      themeDiagnostic(
        'unsafe-theme',
        'error',
        'Executable theme content rejected',
        { theme: id }
      )
    );
    return false;
  }
  for (const value of link.values) {
    if (!safe(value, diagnostics, id)) {
      ok = false;
    }
  }
  return ok;
}

function readForcedColor(args, theme, diagnostics) {
  if (args.length === 2 && isTokenPath(args[0]) && systemColors.has(args[1])) {
    theme.forcedColors.set(args[0], args[1]);
  } else {
    diagnostics.push(
      themeDiagnostic(
        'invalid-forced-color',
        'error',
        'Expected a token path and CSS system color'
      )
    );
  }
}

function readPair(args, theme, diagnostics) {
  const [on, fill, limit] = args;
  const min =
    limit?.[0] === 'min' && limit.length === 2 ? Number(limit[1]) : NaN;
  if (args.length === 2) {
    theme.pairs.push([on, fill]);
  } else if (
    args.length === 3 &&
    Number.isFinite(min) &&
    min >= 1 &&
    min <= 21
  ) {
    theme.pairs.push([on, fill, min]);
  } else {
    diagnostics.push(
      themeDiagnostic('invalid-pair', 'error', 'Invalid pair contrast minimum')
    );
  }
}

function addSpring(args, theme, diagnostics) {
  const spring = readSpring(args);
  if (spring) {
    theme.springs[spring.name] = spring.value;
  } else {
    diagnostics.push(
      themeDiagnostic(
        'invalid-spring',
        'error',
        'Spring needs a name, response in (0,10] seconds and damping in (0,1)'
      )
    );
  }
}

function readThemeChild(child, theme, tokenLinks, diagnostics) {
  const [name, ...args] = raw(child);
  if (name === 'token' && isSpringToken(args)) {
    addSpring(args, theme, diagnostics);
  } else if (name === 'token' || name === 'extends' || name === 'mode') {
    tokenLinks.push(raw(child));
  }
  if (name === 'motion' && args.length > 1) {
    tokenLinks.push(['mode', 'reduced', ...args.slice(1)]);
  }
  if (defaults.has(name) && args.length === 1) {
    theme.defaults[name] = args[0];
  }
  if (name === 'forced-color') {
    readForcedColor(args, theme, diagnostics);
  }
  if (name === 'pair') {
    readPair(args, theme, diagnostics);
  }
  if (name === 'template') {
    const template = readTemplate(args.slice(1), diagnostics);
    if (template !== null) {
      theme.templates.set(args[0], template);
    }
  }
  if (name === 'style') {
    const result = readStyles(
      formatLinks([
        {
          id: `${theme.id}-style-${theme.styles.length}`,
          values: ['style', ...args],
        },
      ])
    );
    theme.styles.push(...result.rules);
    diagnostics.push(...result.diagnostics);
  }
}

/** @param {string} linoText @returns {{themes: object[], diagnostics: object[]}} */
export function loadThemes(linoText) {
  const diagnostics = [];
  const themes = [];
  let links;
  try {
    links = parseNested(linoText);
  } catch (error) {
    return {
      themes,
      diagnostics: [themeDiagnostic('syntax-error', 'error', error.message)],
    };
  }
  for (const link of links) {
    if (head(link) !== 'theme' || link.id === null) {
      continue;
    }
    const theme = {
      id: link.id,
      extends: [],
      tokens: new Map(),
      modes: Object.create(null),
      styles: [],
      templates: new Map(),
      forcedColors: new Map(),
      pairs: [],
      defaults: {},
      springs: {},
      diagnostics: [],
    };
    const tokenLinks = [];
    for (const child of link.values.slice(1)) {
      if (safe(child, diagnostics, link.id)) {
        readThemeChild(child, theme, tokenLinks, diagnostics);
      }
    }
    const result = readTokens(
      formatLinks([{ id: theme.id, values: ['theme', ...tokenLinks] }])
    );
    diagnostics.push(...result.diagnostics);
    theme.set = result.sets.get(theme.id);
    if (!theme.set) {
      continue;
    }
    theme.extends = theme.set.extends;
    theme.tokens = values(new Map(theme.set.tokens.map((t) => [t.path, t])));
    for (const [mode, tokens] of Object.entries(theme.set.modes)) {
      theme.modes[mode] = values(new Map(tokens.map((t) => [t.path, t])));
    }
    themes.push(theme);
  }
  return { themes, diagnostics };
}

/** Merge metadata in the same deterministic parent order as token inheritance. */
export function resolveTheme(registry, id) {
  const sets = new Map([...registry].map(([key, theme]) => [key, theme.set]));
  const diagnostics = [];
  const chain = chainOf(sets, id, diagnostics).map((set) =>
    registry.get(set.id)
  );
  const resolved = resolveTokens(sets, id);
  diagnostics.push(...resolved.diagnostics);
  const theme = {
    id,
    extends: [],
    tokens: values(resolved),
    modes: Object.create(null),
    styles: [],
    templates: new Map(),
    forcedColors: new Map(),
    pairs: [],
    defaults: {},
    springs: {},
    diagnostics,
    set: registry.get(id)?.set,
    sets,
    chain,
  };
  for (const parent of chain) {
    theme.styles.push(...parent.styles);
    for (const [kind, template] of parent.templates) {
      theme.templates.set(kind, template);
    }
    for (const pair of parent.pairs) {
      if (!theme.pairs.some((p) => p.join('\0') === pair.join('\0'))) {
        theme.pairs.push(pair);
      }
    }
    for (const [path, value] of parent.forcedColors ?? []) {
      theme.forcedColors.set(path, value);
    }
    Object.assign(theme.defaults, parent.defaults);
    Object.assign(theme.springs, parent.springs);
  }
  for (const name of resolved.modes.keys()) {
    theme.modes[name] = values(resolveTokens(sets, id, { mode: name }));
  }
  theme.diagnostics = [
    ...new Map(diagnostics.map((d) => [JSON.stringify(d), d])).values(),
  ];
  return theme;
}

/** Resolve a combined scheme, contrast and motion without a second alias resolver. */
export function resolveThemeTokens(theme, modes = []) {
  const sets = theme.sets ?? new Map([[theme.id, theme.set]]);
  const combined = new Map(
    [...sets].map(([id, set]) => [
      id,
      {
        ...set,
        modes: { combined: modes.flatMap((name) => set.modes[name] ?? []) },
      },
    ])
  );
  return resolveTokens(combined, theme.id, { mode: 'combined' });
}
