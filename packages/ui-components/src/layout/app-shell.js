/**
 * `app-shell`: the frame of an application whose navigation follows the
 * width of the viewport — a bottom bar on phones, a rail on tablets and a
 * drawer on wide screens.
 *
 *   (app: app-shell (label Main) (breakpoints 640 1024)
 *     (bottom-bar tabs) (rail rail-nav) (drawer drawer-nav)
 *     (tabs: stack ...) (rail-nav: stack ...) (drawer-nav: stack ...)
 *     (main: stack ...))
 *
 * `breakpoints` are data: up to the first one (640 by default) the shell
 * shows the `bottom-bar` child, below the second one (1024) the `rail`
 * child, and from it on the `drawer` child. The three slots may name the
 * same child. The shown navigation is a `navigation` landmark; the other
 * navigation children are hidden and every other child is content. The
 * shell writes its mode as the `mode` attribute and sends `shell-mode`
 * (`detail.mode`) when it changes.
 */

import { defineKind } from '@link-foundation/ui-dom';
import {
  atomOf,
  controllerOf,
  dropController,
  emit,
  findController,
  isLive,
  linkId,
  renderedChildren,
  valuesOf,
  watchChildren,
} from './dom.js';
import { viewportOf } from './window-frame.js';

/** The slots of the shell, from the narrowest viewport to the widest. */
export const SHELL_MODES = Object.freeze(['bottom-bar', 'rail', 'drawer']);

/** The default breakpoints, in CSS pixels. */
export const SHELL_BREAKPOINTS = Object.freeze([640, 1024]);

/**
 * The mode of the shell at a viewport width: `bottom-bar` up to the first
 * breakpoint, `rail` below the second one, `drawer` from it on.
 * @param {number} width
 * @param {readonly number[]} [breakpoints]
 * @returns {'bottom-bar'|'rail'|'drawer'}
 */
export function shellMode(width, breakpoints = SHELL_BREAKPOINTS) {
  const [narrow, wide] = breakpoints;
  if (width <= narrow) {
    return 'bottom-bar';
  }
  return width < wide ? 'rail' : 'drawer';
}

/** The breakpoints of an element: two increasing numbers, else defaults. */
function breakpointsOf(el, ctx) {
  const values = valuesOf(el, 'breakpoints').map(Number);
  if (values.length === 0) {
    return SHELL_BREAKPOINTS;
  }
  const valid =
    values.length === 2 &&
    values.every((v) => Number.isFinite(v) && v > 0) &&
    values[0] < values[1];
  if (!valid) {
    ctx.diagnostic('invalid-value', 'error', { property: 'breakpoints' });
    return SHELL_BREAKPOINTS;
  }
  return values;
}

/** Mark the navigation of a mode and the content of the shell. */
function assignSlots(node, el, mode) {
  const navs = new Map(
    SHELL_MODES.map((slot) => [slot, atomOf(el, slot)]).filter(
      ([, id]) => id !== undefined
    )
  );
  const shown = navs.get(mode);
  const navIds = new Set(navs.values());
  const label = atomOf(el, 'label') ?? 'Main';
  for (const child of renderedChildren(node)) {
    const id = linkId(child);
    if (id === shown) {
      child.setAttribute('data-slot', mode);
      child.setAttribute('role', 'navigation');
      child.setAttribute('aria-label', label);
      child.removeAttribute('hidden');
    } else if (navIds.has(id)) {
      child.setAttribute('data-slot', 'navigation');
      child.removeAttribute('role');
      child.setAttribute('hidden', '');
    } else {
      child.setAttribute('data-slot', 'content');
    }
  }
}

function createShell(node, ctx) {
  const win = ctx.document.defaultView;
  const state = { el: null, mode: null };

  const refresh = () => {
    const width = viewportOf(ctx.document).width;
    const mode = shellMode(width, breakpointsOf(state.el, ctx));
    assignSlots(node, state.el, mode);
    observer.takeRecords();
    if (mode !== state.mode) {
      const first = state.mode === null;
      state.mode = mode;
      node.setAttribute('mode', mode);
      if (!first) {
        emit(node, 'shell-mode', { mode });
      }
    }
  };

  const observer = watchChildren(node, refresh);
  win.addEventListener('resize', refresh);
  return {
    state,
    update(el) {
      state.el = el;
      refresh();
    },
    disconnect() {
      observer.disconnect();
      win.removeEventListener('resize', refresh);
    },
  };
}

defineKind('app-shell', {
  tag: 'ui-app-shell',
  create: (el, ctx) => ctx.document.createElement('ui-app-shell'),
  update(node, el, changed, ctx) {
    if (isLive(ctx)) {
      controllerOf(node, () => createShell(node, ctx)).update(el);
      return;
    }
    // Without a viewport the static page shows the widest layout; the
    // slots of the children are marked when they are rendered.
    node.setAttribute('mode', 'drawer');
  },
  destroy: (node) => dropController(node),
});

/** The mode of a rendered shell (for tests and tools). */
export const appShellMode = (node) => findController(node)?.state.mode ?? null;
