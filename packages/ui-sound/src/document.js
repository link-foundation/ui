const INTERACTIVE =
  'a[href],button,input,select,textarea,summary,[role="button"],[role="checkbox"],[role="switch"],[role="tab"],[role="radio"],[aria-pressed],[data-sound]';
const TEXT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
]);

/** One delegated capture route for documents whose controls do not use ui-dom. */
export function bindSoundToDocument(
  player,
  {
    root = globalThis.document,
    cueEvent = 'sound-cue',
    now = () => globalThis.performance.now(),
  } = {}
) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const window = doc.defaultView;
  const last = new Map();
  const stops = [];
  const inside = (node) => node && (node === root || root.contains(node));
  const closest = (node, selector) => {
    const match = node?.closest?.(selector);
    return inside(match) ? match : null;
  };
  const disabled = (node) =>
    node?.matches?.(':disabled') ||
    Boolean(node?.closest?.('[disabled],[aria-disabled="true"],[inert]'));
  const cue = (name, event, gap = 0, channel = name) => {
    const time = now();
    if (!name || time - (last.get(channel) ?? -Infinity) < gap) {
      return;
    }
    last.set(channel, time);
    const x = Number.isFinite(event?.clientX)
      ? event.clientX / Math.max(1, window.innerWidth)
      : undefined;
    player.play(name, x === undefined ? {} : { x });
  };
  const target = (event) =>
    event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  const control = (event) => closest(target(event), INTERACTIVE);
  const override = (node, fallback) =>
    closest(node, '[data-sound]')?.getAttribute('data-sound') ?? fallback;
  const handlers = {
    pointerover(event) {
      if (event.pointerType !== 'mouse') {
        return;
      }
      const node = control(event);
      if (!node || disabled(node) || node.contains(event.relatedTarget)) {
        return;
      }
      cue(override(node, 'hover'), event, player.hoverGap ?? 80, 'hover');
    },
    click(event) {
      const node = control(event);
      if (!node || disabled(node)) {
        return;
      }
      if (node.matches('summary')) {
        return;
      }
      const custom = closest(target(event), '[data-sound]');
      if (custom) {
        cue(custom.getAttribute('data-sound'), event);
        return;
      }
      if (node.matches('input[type="range"],select,input[type="color"]')) {
        return;
      }
      const name = node.matches(
        'input[type="checkbox"],[aria-pressed],[role="checkbox"],[role="switch"]'
      )
        ? 'toggle'
        : node.matches('input[type="radio"],[role="tab"],[role="radio"]')
          ? 'select'
          : node.matches('a[href],button,[role="button"]')
            ? 'activate'
            : null;
      cue(name, event);
    },
    toggle(event) {
      const node = target(event);
      if (node?.matches('details') && inside(node) && !disabled(node)) {
        const summary = [...node.children].find((child) =>
          child.matches('summary')
        );
        cue(override(summary ?? node, node.open ? 'open' : 'close'), event);
      }
    },
    input(event) {
      const node = target(event);
      if (!inside(node) || disabled(node)) {
        return;
      }
      if (node.matches('input[type="range"]')) {
        cue(override(node, 'select'), event, 70, 'range');
      } else if (
        node.matches('textarea') ||
        (node.matches('input') && TEXT_TYPES.has(node.type)) ||
        node.isContentEditable
      ) {
        cue(override(node, 'type'), event, 30, 'type');
      }
    },
    change(event) {
      const node = target(event);
      if (
        inside(node) &&
        !disabled(node) &&
        node.matches('select,input[type="color"]')
      ) {
        cue(override(node, 'select'), event);
      }
    },
    pointermove(event) {
      const node = closest(target(event), '[data-sound-scan]');
      if (node && !disabled(target(event))) {
        cue(override(node, 'scan'), event, 90, 'scan');
      }
    },
  };
  for (const [type, handler] of Object.entries(handlers)) {
    root.addEventListener(type, handler, true);
    stops.push(() => root.removeEventListener(type, handler, true));
  }
  const custom = (event) => {
    const detail = event.detail;
    const name = typeof detail === 'string' ? detail : detail?.event;
    if (typeof name === 'string' && name) {
      player.play(name, typeof detail === 'object' ? detail : {});
    }
  };
  if (cueEvent) {
    window.addEventListener(cueEvent, custom, true);
    stops.push(() => window.removeEventListener(cueEvent, custom, true));
  }
  return {
    dispose() {
      stops.forEach((stop) => stop());
    },
  };
}
