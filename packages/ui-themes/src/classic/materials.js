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

/** Apply to a dedicated clipped layer, below content and frame strokes. */
export function materialStyle(material, preferences = {}) {
  validateMaterial(material);
  const transparent = transparencyAllowed(preferences);
  const alpha = transparent ? material.opacity : 1;
  const visible = material.opacity > 0;
  const result = {
    background:
      material.color === 'inherit'
        ? 'transparent'
        : `color-mix(in srgb, ${material.color} ${visible ? alpha * 100 : 0}%, transparent)`,
    'backdrop-filter': materialFilter(material, preferences, transparent),
    '--material-noise': String(transparent && visible ? material.noise : 0),
    '--material-refraction': String(
      transparent && visible ? material.refraction : 0
    ),
  };
  const extended = Object.keys(material).some(
    (key) => !['color', 'opacity', 'blur', 'noise', 'refraction'].includes(key)
  );
  if (extended || material.noise || !visible) {
    Object.assign(
      result,
      opticalStyle(
        { ...material, noise: transparent ? material.noise : 0 },
        visible ? material.opacity : 0
      )
    );
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

export { createEffectGovernor } from './effect-governor.js';

export { createRefractionProvider } from './refraction.js';
export { observeMaterialVisibility } from './material-visibility.js';
export { opticalMaterialCss } from './optical-css.js';
