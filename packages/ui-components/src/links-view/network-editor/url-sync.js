/** Subscribe to committed state without adding browser history entries. */
export function syncNetworkUrl(
  presentation,
  {
    window: win = globalThis.window,
    root = win.document,
    urlFor,
    delay = 400,
    setTimer = win.setTimeout.bind(win),
    clearTimer = win.clearTimeout.bind(win),
    debug,
  } = {}
) {
  if (typeof urlFor !== 'function') {
    throw new TypeError('urlFor must serialize a presentation snapshot');
  }
  let timer;
  let pending;
  let failures = 0;
  let disposed = false;
  const held = new Set();
  const listen = (target, name, fn) => {
    target.addEventListener(name, fn, true);
    return () => target.removeEventListener(name, fn, true);
  };
  const cancel = () => {
    clearTimer(timer);
    timer = undefined;
  };
  function schedule(ms = delay) {
    cancel();
    if (!disposed && pending && held.size === 0) {
      timer = setTimer(write, ms);
    }
  }
  function write() {
    timer = undefined;
    if (disposed || !pending || held.size) {
      return;
    }
    try {
      const url = urlFor(pending, win.location.href);
      win.history.replaceState(win.history.state, '', String(url));
      pending = undefined;
      failures = 0;
      debug?.('network-url:commit');
    } catch (error) {
      failures += 1;
      debug?.('network-url:error', { name: error.name, failures });
      if (failures < 5) {
        schedule(1000 * 2 ** (failures - 1));
      }
    }
  }
  const interactive = (event) =>
    (event.composedPath?.() ?? [event.target]).some((node) =>
      node?.matches?.('input[type="range"], input[type="color"]')
    );
  const down = (id, event) => {
    if (interactive(event)) {
      held.add(id);
      cancel();
    }
  };
  const up = (id) => {
    if (held.delete(id) && !held.size) {
      schedule();
    }
  };
  const sliderKeys = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ]);
  const cleanup = [
    listen(root, 'pointerdown', (e) => down(`pointer:${e.pointerId}`, e)),
    listen(win, 'pointerup', (e) => up(`pointer:${e.pointerId}`)),
    listen(win, 'pointercancel', (e) => up(`pointer:${e.pointerId}`)),
    listen(root, 'touchstart', (e) => {
      for (const touch of e.changedTouches) {
        down(`touch:${touch.identifier}`, e);
      }
    }),
    ...['touchend', 'touchcancel'].map((name) =>
      listen(win, name, (e) => {
        for (const touch of e.changedTouches) {
          up(`touch:${touch.identifier}`);
        }
      })
    ),
    listen(root, 'keydown', (e) => {
      if (sliderKeys.has(e.key)) {
        down(`key:${e.key}`, e);
      }
    }),
    listen(win, 'keyup', (e) => up(`key:${e.key}`)),
    listen(root, 'change', (e) => {
      if (interactive(e) && e.target.type === 'color') {
        held.clear();
        schedule();
      }
    }),
    listen(win, 'blur', () => {
      held.clear();
      schedule();
    }),
    presentation.subscribe((state) => {
      pending = state;
      failures = 0;
      schedule();
    }),
  ];
  return {
    flush: () => {
      cancel();
      write();
    },
    dispose() {
      disposed = true;
      cancel();
      cleanup.forEach((fn) => fn());
      held.clear();
      pending = undefined;
    },
  };
}
