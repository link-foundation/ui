import { formatLinks } from '@link-foundation/ui-core';
import {
  Hct,
  argbFromHex,
  hexFromArgb,
  SchemeTonalSpot,
  SchemeVibrant,
  SchemeNeutral,
} from '@material/material-color-utilities';

const variants = {
  'tonal-spot': SchemeTonalSpot,
  vibrant: SchemeVibrant,
  neutral: SchemeNeutral,
};
// DynamicScheme getters are the authoritative MCU role values (2021 M3 spec).
const roles = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'inversePrimary',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'background',
  'onBackground',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'inverseSurface',
  'inverseOnSurface',
  'outline',
  'outlineVariant',
  'shadow',
  'scrim',
  'primaryFixed',
  'primaryFixedDim',
  'onPrimaryFixed',
  'onPrimaryFixedVariant',
  'secondaryFixed',
  'secondaryFixedDim',
  'onSecondaryFixed',
  'onSecondaryFixedVariant',
  'tertiaryFixed',
  'tertiaryFixedDim',
  'onTertiaryFixed',
  'onTertiaryFixedVariant',
];
const kebab = (value) => value.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
const colorTokens = (scheme) =>
  roles.map((role) => [
    'token',
    `color.${kebab(role)}`,
    hexFromArgb(scheme[role]),
    ['m3', `md.sys.color.${kebab(role)}`],
  ]);
const pairs = [
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary', 'secondary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ['on-error', 'error'],
  ['on-error-container', 'error-container'],
  ['on-background', 'background'],
  ['on-surface', 'surface'],
  ['on-surface-variant', 'surface-variant'],
  ['inverse-on-surface', 'inverse-surface'],
  ...['lowest', 'low', '', 'high', 'highest'].map((level) => [
    'on-surface',
    `surface-container${level ? `-${level}` : ''}`,
  ]),
  ...['primary', 'secondary', 'tertiary'].flatMap((role) => [
    [`on-${role}-fixed`, `${role}-fixed`],
    [`on-${role}-fixed-variant`, `${role}-fixed-dim`],
  ]),
];

/**
 * A complete colour scheme inheriting the Material 3 scales and controls.
 * @param {string} seed hex colour
 * @param {{id?: string, contrast?: number, variant?: 'tonal-spot'|'vibrant'|'neutral'}} [options]
 * @returns {string} LiNo theme, resolved alongside material3 by the theme engine
 */
export function materialThemeFromSeed(seed, options = {}) {
  if (
    typeof seed !== 'string' ||
    !/^#(?:[\da-f]{6}|[\da-f]{3})$/iu.test(seed)
  ) {
    throw new TypeError('Seed must be a three- or six-digit hex colour');
  }
  const {
    id = 'material3-seed',
    contrast = 0,
    variant = 'tonal-spot',
  } = options;
  if (
    !Object.hasOwn(variants, variant) ||
    !Number.isFinite(contrast) ||
    contrast < -1 ||
    contrast > 1
  ) {
    throw new RangeError('Unknown variant or contrast outside [-1, 1]');
  }
  const expanded =
    seed.length === 4
      ? `#${[...seed.slice(1)].map((c) => c + c).join('')}`
      : seed;
  const source = Hct.fromInt(argbFromHex(expanded));
  const Scheme = variants[variant];
  return formatLinks([
    {
      id,
      values: [
        'theme',
        ['extends', 'material3'],
        ...colorTokens(new Scheme(source, false, contrast)),
        ...pairs.map(([on, fill]) => ['pair', `color.${on}`, `color.${fill}`]),
        ['mode', 'dark', ...colorTokens(new Scheme(source, true, contrast))],
        ['mode', 'high-contrast', ...colorTokens(new Scheme(source, false, 1))],
      ],
    },
  ]);
}
