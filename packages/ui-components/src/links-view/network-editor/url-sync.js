const sliderKeys = Object.freeze([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

const listen = (target, name, fn) => {
  target.addEventListener(name, fn, true);
  return () => target.removeEventListener(name, fn, true);
};
const interactive = (event) =>
  (event.composedPath?.() ?? [event.target]).find((node) =>
    node?.matches?.('input[type="range"], input[type="color"]')
  );

function holdListeners(scope, down, releaseMatching) {
  return [
    listen(scope, 'pointerdown', (e) => down(`pointer:${e.pointerId}`, e)),
    listen(scope, 'touchstart', (e) => {
      for (const touch of e.changedTouches) {
        down(`touch:${touch.identifier}`, e);
      }
    }),
    listen(scope, 'keydown', (e) => {
      if (sliderKeys.includes(e.key)) {
        down(`key:${e.key}`, e);
      }
    }),
    listen(scope, 'focusout', (e) => {
      const input = interactive(e);
      releaseMatching(
        (control, id) => control === input && id.startsWith('key:')
      );
    }),
    listen(scope, 'change', (e) => {
      const input = interactive(e);
      if (input?.type === 'color') {
        releaseMatching((control) => control === input);
      }
    }),
  ];
}

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
  const held = new Map();
  const roots = Array.isArray(root) ? root : [root];
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
      const current = win.location.href;
      const url = new win.URL(urlFor(pending, current), current).href;
      if (url !== current) {
        win.history.replaceState(win.history.state, '', url);
        debug?.('network-url:commit');
      }
      pending = undefined;
      failures = 0;
    } catch (error) {
      failures += 1;
      debug?.('network-url:error', { name: error.name, failures });
      if (failures < 5) {
        schedule(1000 * 2 ** (failures - 1));
      }
    }
  }
  function releaseMatching(matches) {
    const wasHeld = held.size > 0;
    for (const [id, control] of held) {
      if (matches(control, id)) {
        held.delete(id);
      }
    }
    if (wasHeld && !held.size) {
      observer?.disconnect();
      schedule();
    }
  }
  const observer = win.MutationObserver
    ? new win.MutationObserver(() =>
        releaseMatching((control) => !control.isConnected)
      )
    : null;
  const down = (id, event) => {
    const control = interactive(event);
    if (control) {
      held.set(id, control);
      const observerOptions = { childList: true, subtree: true };
      observer?.observe(win.document, observerOptions);
      observer?.observe(control.getRootNode(), observerOptions);
      cancel();
    }
  };
  const up = (id) => releaseMatching((_, key) => id === key);
  const cleanup = [
    ...roots.flatMap((scope) => holdListeners(scope, down, releaseMatching)),
    listen(win, 'pointerup', (e) => up(`pointer:${e.pointerId}`)),
    listen(win, 'pointercancel', (e) => up(`pointer:${e.pointerId}`)),
    ...['touchend', 'touchcancel'].map((name) =>
      listen(win, name, (e) => {
        for (const touch of e.changedTouches) {
          up(`touch:${touch.identifier}`);
        }
      })
    ),
    listen(win, 'keyup', (e) => up(`key:${e.key}`)),
    listen(win, 'blur', (e) => {
      if (e.target === win) {
        releaseMatching(() => true);
      }
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
      observer?.disconnect();
      held.clear();
      pending = undefined;
    },
  };
}
