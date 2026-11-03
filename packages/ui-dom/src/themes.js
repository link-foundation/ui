/** Theme boundaries inherit choices, while only their attributes change on a switch. */
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';
import { atom, elementOf } from './model.js';

const BOUNDARY = ['theme', 'scheme', 'contrast', 'motion'];
const COMFORT = ['motion', 'sound', 'volume', 'transparency'];
const CHOICES = {
  scheme: ['light', 'dark', 'system'],
  contrast: ['normal', 'more', 'system'],
  motion: ['full', 'reduced', 'system'],
};
const scalar = (entry) =>
  entry?.value?.length === 1 ? entry.value[0] : undefined;

export function themeRegistry(input, report = () => {}) {
  if (!input) {
    return new Map();
  }
  const result =
    typeof input === 'string'
      ? loadThemes(input)
      : {
          themes: input instanceof Map ? [...input.values()] : input,
          diagnostics: [],
        };
  result.diagnostics.forEach(report);
  const registry = new Map(result.themes.map((theme) => [theme.id, theme]));
  return new Map(
    [...registry].map(([id, theme]) => {
      const resolved = theme.sets ? theme : resolveTheme(registry, id);
      resolved.diagnostics.forEach(report);
      return [id, resolved];
    })
  );
}

/** Effective theme at creation time, including an element's own theme boundary. */
export function themeFor(store, id, options) {
  for (let current = id; current !== null; current = store.parentOf(current)) {
    const theme =
      scalar(options.config?.resolve(current, 'theme')) ??
      atom(elementOf(store.get(current)), 'theme');
    if (theme !== undefined) {
      return options.themeRegistry?.get(theme) ?? null;
    }
  }
  const inherited = inheritedChoices(options);
  return options.themeRegistry?.get(inherited.theme) ?? null;
}

/** Configuration values from user/session outrank all nested theme defaults. */
function comfort(config, lineage, name) {
  for (const layer of ['session', 'user', 'site', 'theme', 'defaults']) {
    for (const id of [...lineage].reverse()) {
      const value = config?.valueIn(layer, id, name);
      if (value?.length === 1) {
        return value[0];
      }
    }
  }
  return undefined;
}

function inheritedChoices(options) {
  const initial = {
    theme: options.theme ?? options.themeRegistry?.keys().next().value ?? '',
    scheme: 'system',
    contrast: 'system',
    motion: 'system',
  };
  // Copy each choice from its nearest DOM ancestor, including the boot script's html.
  for (const name of [...BOUNDARY, ...COMFORT]) {
    for (let host = options.themeHost; host; host = host.parentElement) {
      if (host.hasAttribute(`data-${name}`)) {
        initial[name] = host.getAttribute(`data-${name}`);
        break;
      }
    }
  }
  return initial;
}

function boundaryChoices(own, el, inherited, options, path) {
  const next = { ...inherited };
  for (const name of BOUNDARY) {
    if (
      own[name] !== undefined &&
      (!CHOICES[name] || CHOICES[name].includes(own[name]))
    ) {
      next[name] = own[name];
    }
  }
  const defaults = options.themeRegistry?.get(next.theme)?.defaults ?? {};
  for (const name of COMFORT) {
    next[name] =
      comfort(options.config, path, name) ??
      atom(el, name) ??
      (own.theme !== undefined ? defaults[name] : undefined) ??
      inherited[name];
  }
  return next;
}

function writeBoundary(node, choices) {
  for (const name of new Set([...BOUNDARY, ...COMFORT])) {
    const value = choices?.[name];
    if (value === undefined) {
      node.removeAttribute(`data-${name}`);
    } else if (node.getAttribute(`data-${name}`) !== String(value)) {
      node.setAttribute(`data-${name}`, value);
    }
  }
}

export function applyThemes(tree, store, options) {
  const registry = options.themeRegistry;
  const initial = inheritedChoices(options);
  const visit = (id, inherited, lineage) => {
    const el = tree.elementFor(id),
      node = tree.nodeFor(id);
    if (!el || !node) {
      return;
    }
    const own = Object.fromEntries(
      BOUNDARY.map((name) => [
        name,
        scalar(options.config?.resolve(id, name)) ?? atom(el, name),
      ])
    );
    const boundary =
      BOUNDARY.some((name) => own[name] !== undefined) ||
      (lineage.length === 0 && (registry?.size > 0 || options.config));
    const path = [...lineage, id];
    let next = inherited;
    if (boundary) {
      next = boundaryChoices(own, el, inherited, options, path);
    }
    writeBoundary(node, boundary ? next : null);

    for (const child of store.children(id)) {
      visit(child, next, path);
    }
  };
  for (const id of store.roots()) {
    visit(id, initial, []);
  }
}
