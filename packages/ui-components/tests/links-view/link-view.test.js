/**
 * Behaviour: the `link-view` element draws one link from Links Notation in
 * its own shadow root, is labelled "Link 1 from 1 to 2", zooms with `+`,
 * `-` and `0`, keeps its zoom to itself, redraws at most one time per frame and
 * stops all work when removed. ui-dom renders the `link-view` kind as this
 * element. Runs in jsdom with an injected frame scheduler.
 */

import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { mountDocument } from '@link-foundation/ui-dom';
import {
  KEY_ZOOM_STEP,
  LINK_VIEW_TAG,
  defineLinkView,
  linkViewGeometry,
  registerLinkViewKind,
} from '../../src/links-view/link-view.js';
import { linkColors } from '../../src/links-view/tokens.js';
import { FakePath2D, fakeContext } from './fake-canvas.js';

const ISSUE_EXAMPLE = `(simple: link-view
  (link (id 1) (source 1) (target 2))
  (markers (source bar) (target arrow))
  (blueprint true)
  (grid true))`;

/** A window with a recorded frame queue: `flush()` runs queued frames. */
function setup({ reduced = false, dark = false } = {}) {
  const { window } = new JSDOM(
    '<!doctype html><html><head></head><body><div id="app"></div></body></html>'
  );
  window.matchMedia = (query) => ({
    matches:
      (query === '(prefers-reduced-motion: reduce)' && reduced) ||
      (query === '(prefers-color-scheme: dark)' && dark),
    addEventListener() {},
    removeEventListener() {},
  });
  const queue = [];
  let frames = 0;
  const animator = {
    now: () => 0,
    raf: (callback) => {
      queue.push(callback);
      return queue.length;
    },
    caf: () => {},
  };
  const flush = () => {
    while (queue.length > 0) {
      frames += 1;
      queue.shift()(0);
    }
  };
  return {
    window,
    document: window.document,
    animator,
    flush,
    frames: () => frames,
    queued: () => queue.length,
  };
}

function mount(env, html) {
  defineLinkView(env.window, { animator: env.animator });
  const app = env.document.getElementById('app');
  app.innerHTML = html;
  env.flush();
  return [...app.querySelectorAll(LINK_VIEW_TAG)];
}

const key = (env, el, name) =>
  el.dispatchEvent(
    new env.window.KeyboardEvent('keydown', { key: name, bubbles: true })
  );

describe('link-view element', () => {
  it('draws the issue example as labelled SVG in its shadow root', () => {
    const env = setup();
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Link 1 from 1 to 2');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-keyshortcuts')).toContain('+ - 0');
    expect(el.diagnostics).toEqual([]);
    const svg = el.shadowRoot.querySelector('svg');
    expect(svg).not.toBe(null);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot.querySelectorAll('circle').length).toBe(9);
    expect(el.shadowRoot.querySelector('[data-part="grid-major"]')).not.toBe(
      null
    );
    expect(el.getAttribute('data-markers')).toBe('bar arrow');
    expect(el.drawn.renderer).toBe('svg');
  });

  it('reads the lino attribute and the attribute overrides', () => {
    const env = setup();
    const [el] = mount(
      env,
      `<link-view lino="(f: link-view (link (id 3) (source 1) (target 0)))" blueprint grid="false" label="A free link"></link-view>`
    );
    expect(el.getAttribute('aria-label')).toBe('A free link');
    expect(el.model.target).toBe(null);
    expect(el.model.blueprint).toBe(true);
    expect(el.getAttribute('data-markers')).toBe('bar cross');
    el.removeAttribute('label');
    env.flush();
    expect(el.getAttribute('aria-label')).toBe('Link 3 from 1 to a free end');
  });

  it('draws a self-loop', () => {
    const env = setup();
    const [el] = mount(
      env,
      `<link-view lino="(l: link-view (link (id 2) (source 5) (target 5)))"></link-view>`
    );
    expect(el.getAttribute('aria-label')).toBe(
      'Link 2 from 5 to 5, a self-loop'
    );
    expect(linkViewGeometry(el.model).selfLoop).toBe(true);
  });

  it('zooms with + and -, pans with arrows, resets with 0', () => {
    const env = setup();
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    key(env, el, '+');
    expect(el.view.k).toBe(KEY_ZOOM_STEP);
    key(env, el, '-');
    key(env, el, '-');
    expect(Math.abs(el.view.k - 1 / KEY_ZOOM_STEP) < 1e-12).toBe(true);
    key(env, el, 'ArrowLeft');
    expect(el.view.x !== 0).toBe(true);
    key(env, el, '0');
    expect(el.view).toEqual({ x: 0, y: 0, k: 1 });
    env.flush();
    expect(el.drawn.view.k).toBe(
      env.window.document.querySelector('link-view').drawn.view.k
    );
  });

  it('two elements zoom independently', () => {
    const env = setup();
    const [a, b] = mount(
      env,
      `<link-view>${ISSUE_EXAMPLE}</link-view><link-view>${ISSUE_EXAMPLE}</link-view>`
    );
    key(env, a, '+');
    key(env, a, '+');
    env.flush();
    expect(a.view.k > 1).toBe(true);
    expect(b.view).toEqual({ x: 0, y: 0, k: 1 });
    expect(a.drawn.view.k > b.drawn.view.k).toBe(true);
  });

  it('draws once per frame and asks for no frame while idle', () => {
    const env = setup();
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    const before = env.frames();
    for (let i = 0; i < 5; i += 1) {
      el.zoomBy(1.1);
    }
    expect(env.queued()).toBe(1);
    env.flush();
    expect(env.frames()).toBe(before + 1);
    expect(env.queued()).toBe(0);
  });

  it('draws at once with reduced motion', () => {
    const env = setup({ reduced: true });
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    expect(env.frames()).toBe(0);
    expect(el.drawn).not.toBe(null);
    el.zoomBy(2);
    expect(el.drawn.view.k > 1).toBe(true);
    expect(env.queued()).toBe(0);
  });

  it('uses the dark token colours in a dark scheme or theme', () => {
    const env = setup({ dark: true });
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    const dark = linkColors({ mode: 'dark' });
    const background = el.shadowRoot.querySelector('[data-part="background"]');
    expect(background.getAttribute('fill')).toBe(dark.background);
    el.setAttribute('theme', 'light');
    env.flush();
    expect(
      el.shadowRoot
        .querySelector('[data-part="background"]')
        .getAttribute('fill')
    ).toBe(linkColors().background);
  });

  it('draws on a canvas with the same markers', () => {
    const env = setup();
    const ctx = fakeContext();
    env.window.HTMLCanvasElement.prototype.getContext = () => ctx;
    env.window.Path2D = FakePath2D;
    const [el] = mount(
      env,
      `<link-view renderer="canvas">${ISSUE_EXAMPLE}</link-view>`
    );
    expect(el.shadowRoot.querySelector('canvas')).not.toBe(null);
    expect(el.drawn.renderer).toBe('canvas');
    expect(el.drawn.markers).toEqual(['bar', 'arrow']);
    expect(ctx.calls.some((c) => c[0] === 'bezierCurveTo')).toBe(true);
  });

  it('removes its listeners and frames when removed', () => {
    const env = setup();
    const [el] = mount(env, `<link-view>${ISSUE_EXAMPLE}</link-view>`);
    el.zoomBy(2);
    el.remove();
    expect(el.view).toEqual({ x: 0, y: 0, k: 1 });
    env.flush();
    key(env, el, '+');
    expect(el.view).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('defines the tag once per window', () => {
    const env = setup();
    const first = defineLinkView(env.window);
    expect(defineLinkView(env.window)).toBe(first);
  });
});

describe('ui-dom link-view kind', () => {
  it('renders a link-view element of a ui-dom document', () => {
    const env = setup();
    registerLinkViewKind(env.window, { animator: env.animator });
    const app = env.document.getElementById('app');
    mountDocument(app, `(page: column)\n${ISSUE_EXAMPLE}`, {
      document: env.document,
    });
    env.flush();
    const el = app.querySelector(LINK_VIEW_TAG);
    expect(el).not.toBe(null);
    expect(el.getAttribute('aria-label')).toBe('Link 1 from 1 to 2');
    expect(el.links.name).toBe('simple');
    expect(el.shadowRoot.querySelectorAll('circle').length).toBe(9);
  });
});
