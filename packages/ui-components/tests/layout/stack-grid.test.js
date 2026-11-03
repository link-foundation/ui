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
import { mountLayout } from './helpers.js';

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
