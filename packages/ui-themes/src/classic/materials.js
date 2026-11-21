import { opticalRanges, validateMaterial, opticalStyle } from './optics.js';

import { parseNested } from '@link-foundation/ui-core';

function validateProperty(property, key, value, seen) {
  if (
    !key ||
    !value ||
    key.values.length ||
    value.values.length ||
    property.values.length !== 2 ||
    !(
      Object.hasOwn(opticalRanges, key.id) || ['color', 'tint'].includes(key.id)
    ) ||
    seen.has(key.id)
  ) {
    throw new TypeError('Unknown or duplicate material property');
  }
}

/** Optical material parameters; child content never inherits surface opacity. */
export function readMaterial(text) {
  const roots = parseNested(text);
  const root = roots[0];
  if (roots.length !== 1 || root.values[0]?.id !== 'material') {
    throw new TypeError('Expected one material root');
  }
  const material = {
    color: 'inherit',
    opacity: 1,
    blur: 0,
    noise: 0,
    refraction: 0,
  };
  const seen = new Set();
  for (const property of root.values.slice(1)) {
    const [key, value] = property.values;
    validateProperty(property, key, value, seen);
    seen.add(key.id);
    if (['color', 'tint'].includes(key.id)) {
      material[key.id] = value.id;
    } else {
      const number = Number(value.id);
      material[key.id] = number;
    }
  }
  validateMaterial(material);
  return material;
}

const transparencyAllowed = (preferences) =>
  ![false, 'off'].includes(preferences.transparency) &&
  !(
    (preferences.transparency ?? 'auto') === 'auto' &&
    preferences.reducedTransparency
  );

function materialFilter(material, preferences, transparent) {
  const chain = [];
  if (material.opacity > 0 && transparent) {
    const reference = preferences.refractionProvider?.reference(
      material.refraction,
      preferences
    );
    if (reference) {
      chain.push(reference);
    }
    if (material.blur) {
      chain.push(`blur(${material.blur}px)`);
    }
    for (const [key, fn] of [
      ['saturation', 'saturate'],
      ['brightness', 'brightness'],
      ['contrast', 'contrast'],
    ]) {
      if (material[key] !== undefined && material[key] !== 100) {
        chain.push(`${fn}(${material[key]}%)`);
      }
    }
  }
  return chain.join(' ') || 'none';
}

function materialBackground(material, transparent, surfaceColor) {
  const color = material.color === 'inherit' ? surfaceColor : material.color;
  if (!color) {
    return 'transparent';
  }
  const alpha =
    !transparent && material.opacity > 0 ? 1 : material.opacity || 0;
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

/** Apply to a dedicated clipped layer, below content and frame strokes. */
export function materialStyle(material, preferences = {}, options = {}) {
  validateMaterial(material);
  const { prefix = 'material', surfaceColor, clipPath } = options;
  if (!/^[a-zA-Z_][\w-]*$/u.test(prefix)) {
    throw new TypeError('Invalid material variable prefix');
  }
  const transparent = transparencyAllowed(preferences);
  const visible = material.opacity > 0;
  const effects = transparent && visible;
  const result = {
    background: materialBackground(material, transparent, surfaceColor),
    'backdrop-filter': materialFilter(material, preferences, transparent),
    [`--${prefix}-noise`]: String(effects ? material.noise : 0),
    [`--${prefix}-refraction`]: String(effects ? material.refraction : 0),
  };
  if (clipPath !== undefined) {
    result['clip-path'] = clipPath;
  }
  const extended = Object.keys(material).some(
    (key) => !['color', 'opacity', 'blur', 'noise', 'refraction'].includes(key)
  );
  if (
    extended ||
    material.noise ||
    !visible ||
    options.texture ||
    options.lighting
  ) {
    Object.assign(result, opticalStyle(material, transparent, options));
  }
  return result;
}

/** A preset changes appearance; comfort is owned exclusively by the viewer. */
export function applyAppearancePreset(current, preset, keys) {
  return {
    ...globalThis.structuredClone(current),
    ...globalThis.structuredClone(
      keys
        ? Object.fromEntries(
            keys
              .filter(
                (key) => key !== 'preferences' && Object.hasOwn(preset, key)
              )
              .map((key) => [key, preset[key]])
          )
        : preset
    ),
    preferences: globalThis.structuredClone(current.preferences),
  };
}

export { createQualityWatcher } from './effect-quality.js';
export { createEffectGovernor } from './effect-governor.js';

export { createRefractionProvider } from './refraction.js';
export { observeMaterialVisibility } from './material-visibility.js';
export { opticalMaterialCss } from './optical-css.js';
