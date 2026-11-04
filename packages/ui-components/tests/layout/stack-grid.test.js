/**
 * stack and grid kinds: thin wrappers of flexbox and CSS grid whose values
 * are checked; the layout kinds also render to static HTML.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { renderToHTML } from '@link-foundation/ui-dom';
import {
  areaList,
  layoutVocabulary,
  trackList,
} from '@link-foundation/ui-components';
import { flush, mountLayout } from './helpers.js';

describe('stack kind', () => {
  it('writes the flexbox styles', async () => {
    const page = await mountLayout(`(bar: stack (direction row) (gap 8px)
  (align center)
  (justify space-between)
  (wrap true)
  (a: text 'A')
  (b: text 'B'))`);
    const style = page.node('bar').style;
    expect(style.flexDirection).toBe('row');
    expect(style.gap).toBe('8px');
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('space-between');
    expect(style.flexWrap).toBe('wrap');
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('reports an unknown value and writes nothing for it', async () => {
    const page = await mountLayout(
      `(bar: stack (justify sideways) (a: text 'A'))`
    );
    expect(page.node('bar').style.justifyContent).toBe('');
    // Reported by the vocabulary on parse and by the kind on render.
    expect(
      page.diagnostics.map((d) => [d.code, d.at.property, d.at.element])
    ).toEqual([
      ['invalid-value', 'justify', 'bar'],
      ['invalid-value', 'justify', 'bar'],
    ]);
    page.close();
  });
});

describe('grid kind', () => {
  it('refreshes children and tracks without named areas or callback errors', async () => {
    const page = await mountLayout(`g: grid
  columns 1fr
  a: text A`);
    try {
      expect(page.errors).toEqual([]);
      expect(page.node('a').style.gridArea).toBe('');
      page.store.insert('g', 1, { id: 'b', kind: 'text', positional: ['B'] });
      await flush();
      expect(page.node('b').style.gridArea).toBe('');
      expect(page.node('b').hasAttribute('data-grid-area')).toBe(false);
      page.store.remove('a');
      await flush();
      expect(page.node('a')).toBe(null);
      page.store.setProp('g', 'columns', ['2']);
      page.store.setProp('g', 'rows', ['auto']);
      await flush();
      expect(page.node('g').style.gridTemplateColumns).toBe(
        'repeat(2, minmax(0, 1fr))'
      );
      expect(page.node('g').style.gridTemplateRows).toBe('auto');
      expect(page.node('b').style.gridArea).toBe('');
      expect(page.diagnostics).toEqual([]);
      expect(page.errors).toEqual([]);
    } finally {
      page.close();
    }
  });

  it('places new children and clears assignments when areas are removed', async () => {
    const page = await mountLayout(`g: grid
  areas 'a b'
  a: text A`);
    try {
      expect(page.node('a').style.gridArea).toBe('a');
      page.store.insert('g', 1, { id: 'b', kind: 'text', positional: ['B'] });
      await flush();
      expect(page.node('b').style.gridArea).toBe('b');
      page.store.setProp('g', 'areas', ['b .']);
      await flush();
      expect(page.node('a').style.gridArea).toBe('');
      expect(page.node('a').hasAttribute('data-grid-area')).toBe(false);
      expect(page.node('b').style.gridArea).toBe('b');
      page.store.removeProp('g', 'areas');
      await flush();
      expect(page.node('g').style.gridTemplateAreas).toBe('');
      expect(page.node('b').style.gridArea).toBe('');
      expect(page.node('b').hasAttribute('data-grid-area')).toBe(false);
      page.store.insert('g', 2, { id: 'c', kind: 'text' });
      await flush();
      expect(page.node('c').style.gridArea).toBe('');
      expect(page.errors).toEqual([]);
    } finally {
      page.close();
    }
  });

  it('does not refresh a queued child change after the controller is destroyed', async () => {
    const page = await mountLayout(`g: grid
  areas a`);
    try {
      const grid = page.node('g');
      const child = page.document.createElement('ui-text');
      child.setAttribute('data-link-id', 'a');
      let queued = 0;
      const enqueue = page.window.queueMicrotask.bind(page.window);
      page.window.queueMicrotask = (callback) => {
        queued += 1;
        enqueue(callback);
      };
      grid.appendChild(child);
      // Deliver the real MutationObserver, then destroy before its refresh.
      await Promise.resolve();
      expect(queued).toBe(1);
      page.handle.destroy();
      await flush();
      expect(child.style.gridArea).toBe('');
      expect(child.hasAttribute('data-grid-area')).toBe(false);
      expect(page.errors).toEqual([]);
    } finally {
      page.close();
    }
  });

  it('writes the tracks and places the children named after areas', async () => {
    const page =
      await mountLayout(`(page: grid (columns 16rem 1fr) (rows auto 1fr) (gap 8px)
  (areas 'nav header' 'nav main')
  (header: text 'Header')
  (nav: text 'Nav')
  (main: text 'Main')
  (extra: text 'Extra'))`);
    const grid = page.node('page');
    expect(grid.style.gridTemplateColumns).toBe('16rem 1fr');
    expect(grid.style.gridTemplateRows).toBe('auto 1fr');
    expect(grid.style.gridTemplateAreas).toBe('"nav header" "nav main"');
    expect(page.node('nav').style.gridArea).toBe('nav');
    expect(page.node('extra').style.gridArea).toBe('');
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('reads track functions and N equal columns', () => {
    expect(trackList(['3'])).toBe('repeat(3, minmax(0, 1fr))');
    expect(
      trackList([['repeat', 'auto-fill', ['minmax', '8rem', '1fr']]])
    ).toBe('repeat(auto-fill, minmax(8rem, 1fr))');
  });

  it('rejects a value that is not a track', async () => {
    expect(trackList(['1fr', 'red;background:url(x)'])).toBe(null);
    expect(areaList(['a b', 'c'])).toBe(null);
    const page = await mountLayout(
      `(g: grid (columns 'url(x)') (a: text 'A'))`
    );
    expect(page.node('g').style.gridTemplateColumns).toBe('');
    expect(page.diagnostics.map((d) => d.code)).toEqual(['invalid-value']);
    expect(page.errors).toEqual([]);
    page.close();
  });
});

describe('static HTML of the layout kinds', () => {
  it('renders the split sizes and a closed window without scripts', () => {
    const document = parse(
      `(s: split (sizes 25 75) (a: text 'A') (b: text 'B'))
(w: window (title W) (open false) (c: text 'C'))`,
      { vocabulary: layoutVocabulary() }
    );
    const html = renderToHTML(document);
    expect(html).toContain(
      'style="grid-template-columns: minmax(0, 25fr) minmax(0, 75fr);"'
    );
    expect(html).toContain('<ui-window data-link-id="w" hidden=""');
    expect(html).not.toContain('role="separator"');
  });
});
