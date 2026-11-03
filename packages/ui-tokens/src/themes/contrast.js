import { values } from '@link-foundation/ui-core';
const { parseColor, toHex, oklchToSrgb, srgbToOklch } = values;
const clamp = (n) => Math.max(0, Math.min(1, n));
const colorOf = (raw) => {
  const color =
    typeof raw === 'object' && raw?.type === 'color' ? raw : parseColor(raw);
  if (!color) {
    throw new TypeError('Expected a color');
  }
  return color.space === 'oklch' ? oklchToSrgb(color) : color;
};
const linear = (n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
const luminance = (color) =>
  [color.r, color.g, color.b]
    .map(clamp)
    .map(linear)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);

/** WCAG relative luminance, compositing translucent colors over an opaque canvas. */
export function contrastRatio(fg, bg) {
  const front = colorOf(fg),
    back = colorOf(bg);
  const opaque = { ...back };
  for (const channel of ['r', 'g', 'b']) {
    opaque[channel] = clamp(back[channel]) * back.a + 1 - back.a;
  }
  const composed = { ...front };
  for (const channel of ['r', 'g', 'b']) {
    composed[channel] =
      clamp(front[channel]) * front.a + opaque[channel] * (1 - front.a);
  }
  const a = luminance(composed),
    b = luminance(opaque);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Search both OKLCH lightness directions, comparing the actual quantized output. */
export function ensureContrast(on, fill, min = 4.5) {
  if (!Number.isFinite(min) || min < 1 || min > 21) {
    throw new RangeError('Contrast must be between 1 and 21');
  }
  const original = colorOf(fill);
  const ratio = contrastRatio(on, fill);
  if (ratio >= min) {
    return { color: toHex(original), adjusted: false, ratio };
  }
  const lch = srgbToOklch(original);
  const candidates = [];
  for (const end of [0, 1]) {
    const at = (l) => toHex({ ...lch, l });
    if (contrastRatio(on, at(end)) < min) {
      continue;
    }
    let fail = lch.l,
      pass = end;
    for (let i = 0; i < 30; i++) {
      const mid = (fail + pass) / 2;
      if (contrastRatio(on, at(mid)) >= min) {
        pass = mid;
      } else {
        fail = mid;
      }
    }
    const color = at(pass);
    candidates.push({
      color,
      adjusted: true,
      ratio: contrastRatio(on, color),
      distance: Math.abs(pass - lch.l),
    });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  if (!best) {
    return { color: toHex(original), adjusted: false, ratio };
  }
  return { color: best.color, adjusted: best.adjusted, ratio: best.ratio };
}
