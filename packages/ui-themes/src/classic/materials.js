import { parseNested } from '@link-foundation/ui-core';

function validateProperty(property, key, value, material, seen) {
  if (
    !key ||
    !value ||
    key.values.length ||
    value.values.length ||
    property.values.length !== 2 ||
    !Object.hasOwn(material, key.id) ||
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
    validateProperty(property, key, value, material, seen);
    seen.add(key.id);
    if (key.id === 'color') {
      material.color = value.id;
    } else {
      const number = Number(value.id);
      if (
        !Number.isFinite(number) ||
        number < 0 ||
        (key.id !== 'blur' && number > 1)
      ) {
        throw new RangeError(`Invalid material ${key.id}`);
      }
      material[key.id] = number;
    }
  }
  return material;
}

/** Apply to a dedicated clipped material layer, below content and frame strokes.
 * An inherited color leaves the surface transparent, allowing the parent's
 * painted background to show through without compounding opacity.
 */
export function materialStyle(material, preferences = {}) {
  const transparent = preferences.transparency !== false;
  return {
    background:
      material.color === 'inherit'
        ? 'transparent'
        : `color-mix(in srgb, ${material.color} ${transparent ? material.opacity * 100 : 100}%, transparent)`,
    'backdrop-filter':
      transparent && material.blur ? `blur(${material.blur}px)` : 'none',
    '--material-noise': String(transparent ? material.noise : 0),
    '--material-refraction': String(transparent ? material.refraction : 0),
  };
}

/** A preset changes appearance; comfort is owned exclusively by the viewer. */
export function applyAppearancePreset(current, preset) {
  return {
    ...globalThis.structuredClone(current),
    ...globalThis.structuredClone(preset),
    preferences: globalThis.structuredClone(current.preferences),
  };
}

/**
 * Shared opt-in scheduler for host noise/shader/artwork hooks and sound sinks.
 * Callbacks return true only while more frames are needed. Visibility and
 * reduced-motion switches cancel queued work while retaining pending effects.
 */
export function createEffectGovernor({
  requestFrame = (fn) => globalThis.requestAnimationFrame(fn),
  cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
  onSound = () => {},
} = {}) {
  let state = {
    motion: false,
    reducedMotion: false,
    visible: true,
    sound: false,
    volume: 0,
  };
  let pending = null;
  let disposed = false;
  const effects = new Map();
  const enabled = () =>
    !disposed && state.motion && !state.reducedMotion && state.visible;
  const schedule = () => {
    if (pending === null && enabled() && effects.size) {
      pending = requestFrame(tick);
    }
  };
  function tick(time) {
    pending = null;
    if (!enabled()) {
      return;
    }
    for (const [id, draw] of effects) {
      if (draw(time, { ...state }) !== true && effects.get(id) === draw) {
        effects.delete(id);
      }
    }
    schedule();
  }
  return {
    set(patch) {
      if (disposed) {
        throw new Error('Effect governor is disposed');
      }
      const next = { ...state, ...patch };
      if (!Number.isFinite(next.volume) || next.volume < 0 || next.volume > 1) {
        throw new RangeError('Sound volume must be between zero and one');
      }
      state = next;
      if (!enabled() && pending !== null) {
        cancelFrame(pending);
        pending = null;
      }
      schedule();
    },
    add(id, draw) {
      if (disposed) {
        throw new Error('Effect governor is disposed');
      }
      effects.set(id, draw);
      schedule();
      return () => {
        if (effects.get(id) === draw) {
          effects.delete(id);
        }
        if (!effects.size && pending !== null) {
          cancelFrame(pending);
          pending = null;
        }
      };
    },
    sound(event) {
      if (!disposed && state.visible && state.sound && state.volume > 0) {
        onSound(event, state.volume);
      }
    },
    dispose() {
      disposed = true;
      if (pending !== null) {
        cancelFrame(pending);
      }
      pending = null;
      effects.clear();
    },
  };
}
