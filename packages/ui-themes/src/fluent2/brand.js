import { formatLinks, values } from '@link-foundation/ui-core';
import { fluentTokenPath } from './names.js';
import { BRAND_ALIASES } from './brand-aliases.js';

const stops = Array.from({ length: 16 }, (_, i) => (i + 1) * 10);
/** A seed fixes hue; increasing OKLCH lightness and tapered chroma keep the
 * entire ramp in gamut without clipping that could reverse its lightness. */
export function fluentBrandRamp(seed) {
  const color =
    typeof seed === 'string' && /^#[\da-f]{6}$/iu.test(seed)
      ? values.parseColor(seed)
      : null;
  if (!color) {
    throw new TypeError('Brand seed must be an opaque six-digit hex color');
  }
  const lch = values.srgbToOklch(color);
  return Object.fromEntries(
    stops.map((stop, i) => {
      const l = 0.15 + (i * 0.8) / 15;
      let c = lch.c * Math.sin(Math.PI * l);
      let rgb;
      for (let attempt = 0; attempt < 60; attempt++) {
        rgb = values.oklchToSrgb({ ...lch, l, c });
        if (['r', 'g', 'b'].every((key) => rgb[key] >= 0 && rgb[key] <= 1)) {
          break;
        }
        c *= 0.85;
      }
      return [stop, values.toHex(rgb).toLowerCase()];
    })
  );
}
/** @param {Record<number, string> | string} brand 16 stops (10..160) or seed
 * @param {{id?: string}} [options] @returns {string} LiNo extending fluent2 */
export function fluentThemeFromBrand(brand, options = {}) {
  const ramp = typeof brand === 'string' ? fluentBrandRamp(brand) : brand;
  if (
    !ramp ||
    stops.some(
      (stop) =>
        !Object.hasOwn(ramp, stop) ||
        typeof ramp[stop] !== 'string' ||
        !/^#[\da-f]{6}$/iu.test(ramp[stop])
    ) ||
    Object.keys(ramp).length !== 16
  ) {
    throw new TypeError(
      'Brand ramp must contain exactly 16 opaque hex stops, 10 through 160'
    );
  }
  const id = options.id ?? 'fluent2-brand';
  if (
    typeof id !== 'string' ||
    !/^[a-z][\w-]{0,79}$/iu.test(id) ||
    id === 'fluent2'
  ) {
    throw new TypeError('Expected a distinct theme id');
  }
  const aliases = (mode) =>
    Object.entries(BRAND_ALIASES[mode]).map(([name, stop]) => [
      'token',
      fluentTokenPath(name),
      ramp[stop],
      ['fluent', name],
    ]);
  return formatLinks([
    {
      id,
      values: [
        'theme',
        ['extends', 'fluent2'],
        ...aliases('light'),
        ['mode', 'dark', ...aliases('dark')],
        [
          'mode',
          'high-contrast',
          ...Object.entries(BRAND_ALIASES['high-contrast']).map(
            ([name, value]) => ['token', fluentTokenPath(name), value]
          ),
        ],
      ],
    },
  ]);
}
