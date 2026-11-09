import { values } from '@link-foundation/ui-core';

export const opticalRanges = Object.freeze({
  opacity: [0, 1, 1],
  blur: [0, 48, 0],
  noise: [0, 1, 0],
  refraction: [0, 1, 0],
  saturation: [100, 300, 100],
  brightness: [70, 150, 100],
  contrast: [50, 200, 100],
  'tint-level': [0, 1, 0],
  highlight: [0, 1, 0],
  depth: [0, 1, 0],
  'depth-blur': [0, 80, 0],
  shadow: [0, 1, 0],
  'shadow-blur': [0, 100, 0],
  'shadow-distance': [0, 60, 0],
  'shadow-spread': [-20, 30, 0],
  sheen: [0, 0.8, 0],
  'sheen-angle': [0, 360, 0],
  'light-angle': [0, 360, 0],
  'border-width': [0, 8, 0],
  'border-light': [0, 1, 0],
});
export function validateMaterial(material) {
  for (const [key, [min, max]] of Object.entries(opticalRanges)) {
    const n = material[key];
    if (n !== undefined && (!Number.isFinite(n) || n < min || n > max)) {
      throw new RangeError(`Invalid material ${key}`);
    }
  }
  for (const [key, neutral] of [['tint', 'theme']]) {
    if (
      material[key] !== undefined &&
      material[key] !== neutral &&
      !values.parseColor(material[key])
    ) {
      throw new TypeError(`Invalid material ${key}`);
    }
  }
}

/** Pure, bounded generation: browsers reuse the identical URI until either input changes. */
export function materialNoise(noise, opacity) {
  if (!noise || !opacity) {
    return 'none';
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept="${noise * opacity}"/></feComponentTransfer></filter><path d="M0 0h128v128H0z" filter="url(#g)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function opticalShadows(m, alpha) {
  const light = (n) => `rgb(255 255 255 / ${n * alpha})`;
  const shadows = [];
  if (m.highlight) {
    shadows.push(
      `inset 0 1px ${light(m.highlight)}`,
      `inset 1px 0 ${light(m.highlight * 0.35)}`,
      `inset -1px 0 ${light(m.highlight * 0.35)}`,
      `inset 0 -1px ${light(m.highlight * 0.25)}`
    );
  }
  if (m.depth) {
    shadows.push(`inset 0 0 ${m['depth-blur'] ?? 0}px ${light(m.depth)}`);
  }
  if (m.shadow) {
    shadows.push(
      `0 ${m['shadow-distance'] ?? 0}px ${m['shadow-blur'] ?? 0}px ${m['shadow-spread'] ?? 0}px rgb(0 0 0 / ${m.shadow * alpha})`
    );
  }
  return shadows;
}

function opticalImages(m, alpha) {
  const light = (n) => `rgb(255 255 255 / ${n * alpha})`;
  const images = [];
  if (m.noise && alpha) {
    images.push(materialNoise(m.noise, alpha));
  }
  if (m.sheen && alpha) {
    images.push(
      `linear-gradient(${m['sheen-angle'] ?? 0}deg, transparent, ${light(m.sheen)}, transparent)`,
      `linear-gradient(${m['light-angle'] ?? 0}deg, ${light(m.sheen * 0.35)}, transparent)`
    );
  }
  if (m['tint-level'] && alpha) {
    const tint =
      !m.tint || m.tint === 'theme'
        ? 'var(--color-surface, currentColor)'
        : m.tint;
    const color = `color-mix(in srgb, ${tint} ${m['tint-level'] * alpha * 100}%, transparent)`;
    images.push(`linear-gradient(${color}, ${color})`);
  }
  return images;
}

export function opticalStyle(m, alpha) {
  const shadows = opticalShadows(m, alpha);
  const images = opticalImages(m, alpha);
  return {
    'background-image': images.join(', ') || 'none',
    'box-shadow': alpha ? shadows.join(', ') || 'none' : 'none',
    'border-width': `${m['border-width'] ?? 0}px`,
    'border-style': 'solid',
    'border-color': `rgb(255 255 255 / ${(m['border-light'] ?? 0) * alpha})`,
  };
}
