import { createEffectGovernor } from '@link-foundation/ui-themes/classic/materials';

let nextLayerId = 0;

export const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value) || 0));
export const bounded = (options, ranges) => ({
  ...options,
  ...Object.fromEntries(
    Object.entries(ranges).map(([key, [min, max]]) => [
      key,
      clamp(options[key], min, max),
    ])
  ),
});
export const radians = (degrees) => (Number(degrees) * Math.PI) / 180;
export const noop = () => ({ update() {}, animate() {}, dispose() {} });
export const changed = (a, b, keys) => keys.some((key) => a[key] !== b[key]);

function decorate(canvas, options) {
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-ui-background', '');
  Object.assign(canvas.style, {
    pointerEvents: 'none',
    opacity: String(clamp(options.level, 0, options.maxLevel ?? 2)),
    zIndex: String(options.order),
    filter: options.lightScheme ? 'invert(1) hue-rotate(180deg)' : '',
  });
  if (options.lightScheme) {
    canvas.style.opacity = String(
      clamp(options.level, 0, 2) * clamp(options.lightOpacity, 0, 1)
    );
  }
}

function printStyle(doc) {
  if (!doc || doc.querySelector?.('style[data-ui-background-print]')) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute('data-ui-background-print', '');
  style.textContent =
    '@media print { [data-ui-background] { display: none !important; } }';
  doc.head?.append(style);
}

function subscriptions(s) {
  const { win, doc, media, light } = s;
  const visibility = () => {
    s.sync();
  };
  const preference = () => {
    s.driver.invalidate?.();
    s.repaint();
    s.sync();
  };
  const resize = () => s.resize();
  doc?.addEventListener('visibilitychange', visibility);
  media?.addEventListener('change', preference);
  light?.addEventListener('change', preference);
  win.addEventListener?.('resize', resize);
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(s.canvas);
  return () => {
    observer?.disconnect();
    doc?.removeEventListener('visibilitychange', visibility);
    media?.removeEventListener('change', preference);
    light?.removeEventListener('change', preference);
    win.removeEventListener?.('resize', resize);
  };
}

function lifecycle(s) {
  const quality = { scale: 1, fps: 1 };
  let remove,
    adaptive,
    previous = null,
    lastDraw = null;
  const active = () => s.options.animate && !s.doc?.hidden && !s.reduced();
  const reset = () => {
    previous = lastDraw = null;
    s.driver.resetClock?.();
  };
  const tick = (time, _state, elapsed, shares = { scale: 1, fps: 1 }) => {
    if (elapsed === 0) {
      previous = lastDraw = null;
    }
    const gap = previous === null ? 0 : time - previous;
    previous = time;
    if (s.options.adaptive) {
      quality.scale = Math.min(quality.scale, shares.scale);
      quality.fps = Math.min(quality.fps, shares.fps);
    }
    if (s.scale !== quality.scale) {
      s.scale = quality.scale;
      s.resize();
    }
    s.driver.frame?.(gap);
    const fps = clamp(s.options.fps, 5, 60) * quality.fps;
    const ready = s.driver.cadence
      ? gap > 0 && s.driver.cadence(fps)
      : lastDraw === null || time - lastDraw + 0.01 >= 1000 / fps;
    if (ready) {
      const dt =
        lastDraw === null ? 0 : clamp((time - lastDraw) / 1000, 0, 0.25);
      lastDraw = time;
      s.draw(dt, true);
    }
    return true;
  };
  s.sync = () => {
    if (remove && (!active() || adaptive !== s.options.adaptive)) {
      remove();
      remove = null;
      reset();
    }
    if (!remove && active()) {
      reset();
      adaptive = s.options.adaptive;
      // Keep full display cadence for rain's measured-frame quantization.
      // The governor owns adaptive shares; the layer applies its live fps cap.
      remove = s.governor.add(s.id, tick, {
        resolution: s.driver.webgl === true,
        minScale: adaptive ? 0.4 : 1,
        minFps: adaptive ? 0.25 : 1,
      });
    }
    if (!s.doc?.hidden && s.dirty) {
      s.repaint();
    }
  };
  return () => {
    remove?.();
    reset();
  };
}

function rendering(s) {
  s.reduced = () => s.options.reducedMotion ?? s.media?.matches ?? false;
  s.draw = (dt = 0, frame = false) => {
    if (s.disposed || s.doc?.hidden) {
      s.dirty = true;
      return;
    }
    s.driver.draw(dt, {
      ...s.size,
      still: s.reduced(),
      options: s.options,
      frame,
    });
    s.dirty = false;
  };
  s.repaint = () => {
    decorate(s.canvas, {
      ...s.options,
      level: s.driver.css ? 1 : s.options.level,
      lightScheme: s.options.lightScheme && s.light?.matches,
    });
    s.draw();
  };
  s.resize = () => {
    const rect = s.canvas.getBoundingClientRect();
    const dpr = Math.min(
      s.win.devicePixelRatio || 1,
      clamp(s.options.dprCap, 0.1, 8)
    );
    const ratio =
      dpr *
      (s.driver.webgl ? clamp(s.options.resolution * s.scale, 0.2, 1) : 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    const next = { width: rect.width, height: rect.height, dpr, ratio };
    if (
      s.size &&
      !changed(s.size, next, Object.keys(next)) &&
      (s.driver.css || (s.canvas.width === width && s.canvas.height === height))
    ) {
      return;
    }
    const old = s.size;
    s.size = next;
    if (!s.driver.css) {
      s.canvas.width = width;
      s.canvas.height = height;
    }
    s.driver.resize(next, old);
    s.repaint();
  };
}

function createDriver(canvas, win, options, create) {
  let driver;
  try {
    driver = create(canvas, win, options);
  } catch (error) {
    options.onError?.(error);
  }
  if (!driver) {
    if (canvas?.style) {
      canvas.style.visibility = 'hidden';
    }
    return null;
  }
  return driver;
}

function initialize(s, stop, options) {
  const { driver, canvas } = s;
  try {
    driver.update(s.options, {});
    s.resize();
    s.sync();
  } catch (error) {
    stop();
    driver.dispose?.();
    if (!options.governor) {
      s.governor.dispose();
    }
    canvas.style.visibility = 'hidden';
    options.onError?.(error);
    return false;
  }
  return true;
}

/** Internal shared mount: each effect supplies only its drawing/model driver. */
export function mountLayer(canvas, options, create) {
  const doc = canvas?.ownerDocument;
  const win = options.environment ?? doc?.defaultView ?? globalThis;
  canvas?.setAttribute('aria-hidden', 'true');
  canvas?.setAttribute('data-ui-background', '');
  if (canvas?.style) {
    canvas.style.pointerEvents = 'none';
  }
  printStyle(doc);
  const driver = createDriver(canvas, win, options, create);
  if (!driver) {
    return noop();
  }
  const s = {
    canvas,
    doc,
    win,
    driver,
    id: `ui-background-${++nextLayerId}`,
    scale: 1,
    dirty: false,
    disposed: false,
    options: {
      animate: true,
      fps: 60,
      dprCap: 2,
      resolution: 1,
      adaptive: true,
      level: 1,
      order: 0,
      lightScheme: false,
      lightOpacity: 0.65,
      reducedMotion: undefined,
      ...driver.defaults,
      ...options,
    },
    media: win.matchMedia?.('(prefers-reduced-motion: reduce)'),
    light: win.matchMedia?.('(prefers-color-scheme: light)'),
  };
  s.governor =
    options.governor ??
    createEffectGovernor({
      requestFrame: (fn) => win.requestAnimationFrame(fn),
      cancelFrame: (id) => win.cancelAnimationFrame(id),
    });
  if (!options.governor) {
    s.governor.set({ motion: true });
  }
  rendering(s);
  const stop = lifecycle(s);
  if (!initialize(s, stop, options)) {
    return noop();
  }
  const unsubscribe = subscriptions(s);
  return {
    update(partial) {
      if (s.disposed) {
        return;
      }
      const before = s.options;
      s.options = { ...before, ...partial };
      const visual = driver.update(s.options, before);
      const commonVisual = changed(before, s.options, [
        'level',
        'order',
        'lightScheme',
        'lightOpacity',
        'reducedMotion',
      ]);
      if (changed(before, s.options, ['dprCap', 'resolution'])) {
        s.resize();
      } else if (visual || commonVisual) {
        s.repaint();
      }
      s.sync();
    },
    animate(on) {
      if (!s.disposed) {
        s.options.animate = Boolean(on);
        s.sync();
      }
    },
    dispose() {
      if (s.disposed) {
        return;
      }
      s.disposed = true;
      stop();
      unsubscribe();
      driver.dispose?.();
      if (!options.governor) {
        s.governor.dispose();
      }
    },
  };
}
