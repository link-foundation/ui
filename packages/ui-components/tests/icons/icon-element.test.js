/**
 * The `ui-icon` element in jsdom: decorative without a label, an image
 * named by the label with one, RTL mirroring, re-rendering when its set
 * changes, and the `icon` kind of Links Notation documents.
 */

import { describe, it, expect } from 'test-anywhere';
import { mountDocument } from '@link-foundation/ui-dom';
import { parse } from '@link-foundation/ui-core';
import {
  ICON_TAG,
  defineIconElement,
  iconVocabulary,
} from '../../src/icons/icon.js';
import {
  createStaticSource,
  registerIconSet,
} from '../../src/icons/icon-registry.js';
import { createDom } from './helpers.js';

/** A fresh window with `ui-icon` defined. */
function setup(options) {
  const dom = createDom(options);
  defineIconElement(dom.window);
  return dom;
}

/** Append `<ui-icon>` with attributes and wait for its drawing. */
async function icon({ document, container }, attributes) {
  const el = document.createElement(ICON_TAG);
  for (const [name, value] of Object.entries(attributes)) {
    el.setAttribute(name, value);
  }
  container.append(el);
  await el.ready;
  return el;
}

const FIXTURE = {
  set: 'fixture',
  icons: {
    close: { viewBox: '0 0 10 10', body: '<path d="M1 1 9 9"/>', record: 'f' },
  },
  records: [
    { id: 'f', kind: 'icon', files: [], license: 'MIT', copyright: 'Me' },
  ],
};

describe('ui-icon', () => {
  it('defines the element once per window', () => {
    const { window } = createDom();
    const first = defineIconElement(window);
    expect(defineIconElement(window)).toBe(first);
    expect(window.customElements.get(ICON_TAG)).toBe(first);
    expect(defineIconElement({})).toBe(undefined);
  });

  it('is decorative without a label', async () => {
    const dom = setup();
    const el = await icon(dom, { name: 'close' });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-label')).toBe(false);
    const svg = el.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(el.innerHTML.includes('currentColor')).toBe(true);
    expect(el.getAttribute('data-icon-set')).toBe('own');
    expect(dom.document.querySelectorAll('style[data-ui-icon]').length).toBe(1);
  });

  it('is an image named by its label', async () => {
    const dom = setup();
    const el = await icon(dom, { name: 'check', label: 'Done' });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Done');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    el.setAttribute('label', '  ');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    el.setAttribute('label', 'Saved');
    expect(el.getAttribute('aria-label')).toBe('Saved');
  });

  it('mirrors direction icons in RTL unless told otherwise', async () => {
    const dom = setup({ dir: 'rtl' });
    const send = await icon(dom, { name: 'send' });
    expect(send.hasAttribute('data-mirror')).toBe(true);
    send.setAttribute('mirror', 'false');
    expect(send.hasAttribute('data-mirror')).toBe(false);
    const close = await icon(dom, { name: 'close' });
    expect(close.hasAttribute('data-mirror')).toBe(false);
    close.setAttribute('mirror', 'true');
    expect(close.hasAttribute('data-mirror')).toBe(true);
  });

  it('shows the placeholder for an unknown name', async () => {
    const el = await icon(setup(), { name: 'no-such-icon' });
    expect(el.hasAttribute('data-placeholder')).toBe(true);
    expect(el.querySelector('svg')).not.toBe(null);
  });

  it('redraws when its name or set changes', async () => {
    const dom = setup();
    const el = await icon(dom, { name: 'close', set: 'fixture' });
    expect(el.getAttribute('data-icon-set')).toBe('own');
    const unregister = registerIconSet('fixture', createStaticSource(FIXTURE));
    try {
      await el.ready;
      expect(el.getAttribute('data-icon-set')).toBe('fixture');
      expect(el.querySelector('svg').getAttribute('viewBox')).toBe('0 0 10 10');
      el.setAttribute('name', 'menu');
      await el.ready;
      expect(el.getAttribute('data-icon-set')).toBe('own');
      el.setAttribute('name', 'close');
      await el.ready;
      expect(el.getAttribute('data-icon-set')).toBe('fixture');
    } finally {
      unregister();
    }
    await el.ready;
    expect(el.getAttribute('data-icon-set')).toBe('own');
  });

  it('drops scripts and handlers from icon markup', async () => {
    const evil = {
      set: 'evil',
      icons: {
        close: {
          viewBox: '0 0 1 1',
          body: '<script>1</script><path onclick="x()" d="M0 0"/><use href="https://x/y#z"/>',
          record: 'e',
        },
      },
      records: [],
    };
    const unregister = registerIconSet('evil', createStaticSource(evil));
    try {
      const el = await icon(setup(), { name: 'close', set: 'evil' });
      expect(el.querySelector('script')).toBe(null);
      expect(el.querySelector('path').hasAttribute('onclick')).toBe(false);
      expect(el.querySelector('use').hasAttribute('href')).toBe(false);
    } finally {
      unregister();
    }
  });
});

describe('icon kind', () => {
  it('parses (icon close) and (icon (set lucide) (name check))', () => {
    const { diagnostics } = parse(
      "(app: document\n  (icon close)\n  (ok: icon (set lucide) (name check) (label 'Done')))",
      { vocabulary: iconVocabulary() }
    );
    expect(diagnostics).toEqual([]);
  });

  it('renders icon elements of a document', async () => {
    const dom = setup();
    const { diagnostics } = mountDocument(
      dom.container,
      "(app: document\n  (icon close)\n  (ok: icon (set lucide) (name check) (label 'Done')))",
      { parseOptions: { vocabulary: iconVocabulary() } }
    );
    expect(diagnostics).toEqual([]);
    const icons = [...dom.container.querySelectorAll(ICON_TAG)];
    expect(icons.length).toBe(2);
    await Promise.all(icons.map((el) => el.ready));
    const [close, ok] = icons;
    expect(close.getAttribute('name')).toBe('close');
    expect(close.getAttribute('aria-hidden')).toBe('true');
    expect(ok.getAttribute('set')).toBe('lucide');
    expect(ok.getAttribute('name')).toBe('check');
    expect(ok.getAttribute('role')).toBe('img');
    expect(ok.getAttribute('aria-label')).toBe('Done');
    expect(ok.querySelector('svg')).not.toBe(null);
  });

  it('warns about an icon without a name', () => {
    const dom = setup();
    const { diagnostics } = mountDocument(
      dom.container,
      "(app: document\n  (icon (label 'Nothing')))",
      { parseOptions: { vocabulary: iconVocabulary() } }
    );
    expect(diagnostics.some((d) => d.code === 'missing-icon-name')).toBe(true);
  });
});
