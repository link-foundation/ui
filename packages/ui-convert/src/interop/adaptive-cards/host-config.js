/**
 * Adaptive Cards host config -> ui-dialect theme.
 *
 * Mapped paths (names follow the #47 theme tokens):
 *
 *   containerStyles.<s>.backgroundColor              color.<s>.background
 *   containerStyles.<s>.borderColor                  color.<s>.border
 *   containerStyles.<s>.foregroundColors.<c>.default color.<s>.<c>
 *   containerStyles.<s>.foregroundColors.<c>.subtle  color.<s>.<c>.subtle
 *   spacing.<k>                                      space.<k> (px)
 *   imageSizes.<k>                                   size.image.<k> (px)
 *   separator.lineColor, separator.lineThickness     color.separator,
 *                                                    border.separator (px)
 *   fontTypes.<t>.fontFamily                         font.<t>.family
 *   fontTypes.<t>.fontSizes.<k>                      font.<t>.size.<k> (px)
 *   fontTypes.<t>.fontWeights.<k>                    font.<t>.weight.<k>
 *   fontFamily, fontSizes.<k>, fontWeights.<k>       as fontTypes.default
 *
 * The default container style also gives the semantic tokens
 * `color.surface`, `color.on-surface`, `color.primary` and
 * `color.on-surface-variant` as references. Every other leaf path is listed
 * in `(unmapped ...)`. Colours `#AARRGGBB` are rewritten as `#RRGGBBAA`.
 */

import { Diagnostics } from '../../diagnostics.js';
import { isObject } from '../safety.js';
import { element, prop, slug, writeLino } from '../lino.js';
import { FORMAT } from './shared.js';

const isHex = (c) => '0123456789abcdefABCDEF'.includes(c);

/**
 * A host config colour as a ui-dialect colour, or `null`.
 * @param {unknown} text `#RGB`, `#RRGGBB` or `#AARRGGBB`
 */
export function hostColour(text) {
  if (typeof text !== 'string' || !text.startsWith('#')) {
    return null;
  }
  const digits = text.slice(1);
  if (![3, 6, 8].includes(digits.length) || ![...digits].every(isHex)) {
    return null;
  }
  const hex =
    digits.length === 8 ? digits.slice(2) + digits.slice(0, 2) : digits;
  return `#${hex.toUpperCase()}`;
}

/** Token segment for a host config key: `extraLarge` -> `extra-large`. */
const segment = (key) =>
  slug(String(key).replace(/[A-Z]/g, (c) => `-${c}`)) || 'key';

const SEMANTIC = [
  ['color.surface', 'color.default.background'],
  ['color.on-surface', 'color.default.default'],
  ['color.on-surface-variant', 'color.default.default.subtle'],
  ['color.primary', 'color.default.accent'],
];

class ThemeBuilder {
  constructor() {
    /** @type {[string, string|string[]][]} */
    this.tokens = [];
    this.mapped = new Set();
    this.diagnostics = new Diagnostics(FORMAT);
  }

  token(name, value, path) {
    this.tokens.push([name, value]);
    this.mapped.add(path);
  }

  colour(name, text, path) {
    const colour = hostColour(text);
    if (colour) {
      this.token(name, colour, path);
    }
  }

  number(name, value, path, unit) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.token(name, `${value}${unit}`, path);
    }
  }

  containers(styles) {
    for (const [style, spec] of Object.entries(
      isObject(styles) ? styles : {}
    )) {
      const base = `containerStyles.${style}`;
      const name = `color.${segment(style)}`;
      this.colour(
        `${name}.background`,
        spec?.backgroundColor,
        `${base}.backgroundColor`
      );
      this.colour(`${name}.border`, spec?.borderColor, `${base}.borderColor`);
      const colours = isObject(spec?.foregroundColors)
        ? spec.foregroundColors
        : {};
      for (const [colour, shades] of Object.entries(colours)) {
        const path = `${base}.foregroundColors.${colour}`;
        this.colour(
          `${name}.${segment(colour)}`,
          shades?.default,
          `${path}.default`
        );
        this.colour(
          `${name}.${segment(colour)}.subtle`,
          shades?.subtle,
          `${path}.subtle`
        );
      }
    }
  }

  /** `<group>.<k>` numbers as `<prefix>.<k>` tokens in px. */
  sizes(group, values, prefix) {
    for (const [key, value] of Object.entries(isObject(values) ? values : {})) {
      this.number(`${prefix}.${segment(key)}`, value, `${group}.${key}`, 'px');
    }
  }

  separator(separator) {
    this.colour('color.separator', separator?.lineColor, 'separator.lineColor');
    this.number(
      'border.separator',
      separator?.lineThickness,
      'separator.lineThickness',
      'px'
    );
  }

  font(type, spec, prefix) {
    if (!isObject(spec)) {
      return;
    }
    const name = `font.${segment(type)}`;
    if (typeof spec.fontFamily === 'string') {
      this.token(`${name}.family`, spec.fontFamily, `${prefix}fontFamily`);
    }
    for (const [group, part, unit] of [
      ['fontSizes', 'size', 'px'],
      ['fontWeights', 'weight', ''],
    ]) {
      for (const [key, value] of Object.entries(
        isObject(spec[group]) ? spec[group] : {}
      )) {
        this.number(
          `${name}.${part}.${segment(key)}`,
          value,
          `${prefix}${group}.${key}`,
          unit
        );
      }
    }
  }

  semantic() {
    const names = new Set(this.tokens.map(([name]) => name));
    for (const [name, target] of SEMANTIC) {
      if (names.has(target) && !names.has(name)) {
        this.tokens.push([name, ['token', target]]);
      }
    }
  }
}

/** Every leaf path of a JSON value (`a.b.0.c`). */
function leafPaths(value, prefix = '') {
  if (Array.isArray(value) || isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 0) {
      return entries.flatMap(([key, inner]) =>
        leafPaths(inner, prefix ? `${prefix}.${key}` : key)
      );
    }
  }
  return [prefix];
}

/**
 * Convert an Adaptive Cards host config into a theme.
 * @param {unknown} hostConfig
 * @param {{ id?: string }} [options] the theme id (default `adaptive-cards`)
 * @returns {string} the theme as LiNo text; use
 *   {@link hostConfigToThemeDetails} for the token list and diagnostics
 */
export function hostConfigToTheme(hostConfig, options = {}) {
  return hostConfigToThemeDetails(hostConfig, options).lino;
}

/**
 * {@link hostConfigToTheme} with the tokens, the unmapped paths and the
 * diagnostics.
 * @param {unknown} hostConfig
 * @param {{ id?: string }} [options]
 */
export function hostConfigToThemeDetails(hostConfig, options = {}) {
  const builder = new ThemeBuilder();
  const config = isObject(hostConfig) ? hostConfig : {};
  if (!isObject(hostConfig)) {
    builder.diagnostics.error(
      'not-host-config',
      'The host config is not an object.',
      { path: '' }
    );
  }
  builder.containers(config.containerStyles);
  builder.sizes('spacing', config.spacing, 'space');
  builder.sizes('imageSizes', config.imageSizes, 'size.image');
  builder.separator(isObject(config.separator) ? config.separator : {});
  const types = isObject(config.fontTypes) ? config.fontTypes : {};
  for (const [type, spec] of Object.entries(types)) {
    builder.font(type, spec, `fontTypes.${type}.`);
  }
  if (!('default' in types)) {
    builder.font('default', config, '');
  }
  builder.semantic();
  const unmapped = leafPaths(config).filter(
    (p) => p !== '' && !builder.mapped.has(p)
  );
  if (unmapped.length > 0) {
    builder.diagnostics.info(
      'unmapped-host-config',
      `${unmapped.length} host config paths have no theme token.`,
      { paths: unmapped }
    );
  }
  const theme = element(options.id ?? FORMAT, 'theme', {
    properties: [
      prop('source', FORMAT, 'host-config'),
      ...builder.tokens.map(([name, value]) => prop('token', name, value)),
      unmapped.length > 0 ? prop('unmapped', ...unmapped) : null,
    ],
  });
  const lino = writeLino([theme]);
  return {
    lino,
    tokens: new Map(builder.tokens),
    unmapped,
    diagnostics: builder.diagnostics.list,
  };
}
