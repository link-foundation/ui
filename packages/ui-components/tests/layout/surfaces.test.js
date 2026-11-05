/**
 * The surface kinds: container, paper, card and app-bar. They are thin, so
 * the tests pin their attributes, parts and accessible structure, and that
 * each one is documented by the vocabulary, a catalog entry and a story.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { getKind, renderToHTML } from '@link-foundation/ui-dom';
import { layoutVocabulary } from '@link-foundation/ui-components';
import { parseStories } from '../../src/controls/index.js';
import { mountLayout } from './helpers.js';

const pkg = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const SURFACES = ['container', 'paper', 'card', 'app-bar'];
const mountOne = async (line) => {
  const page = await mountLayout(line);
  return { ...page, target: page.node('x') };
};

describe('container', () => {
  it('defaults to a large column with gutters', async () => {
    const { target, diagnostics } = await mountOne(`(x: container)`);
    expect(target.localName).toBe('ui-container');
    expect(target.getAttribute('size')).toBe('large');
    expect(target.hasAttribute('gutters')).toBe(false);
    expect(diagnostics).toEqual([]);
  });

  it('takes a size and can drop its gutters', async () => {
    const { target } = await mountOne(`(x: container (size small)
    (gutters false)
    (y: text Hi))`);
    expect(target.getAttribute('size')).toBe('small');
    expect(target.getAttribute('gutters')).toBe('false');
    expect(target.textContent).toBe('Hi');
  });
});

describe('paper', () => {
  it('defaults to elevation 1', async () => {
    const { target } = await mountOne(`(x: paper)`);
    expect(target.getAttribute('elevation')).toBe('1');
    expect(target.getAttribute('variant')).toBe('elevated');
    expect(target.hasAttribute('square')).toBe(false);
  });

  it('keeps the elevation within the token levels', async () => {
    const high = await mountOne(`(x: paper (elevation 9))`);
    const low = await mountOne(`(x: paper (elevation -1))`);
    expect(high.target.getAttribute('elevation')).toBe('5');
    expect(low.target.getAttribute('elevation')).toBe('0');
  });

  it('can be outlined and square', async () => {
    const { target } = await mountOne(
      `(x: paper (variant outlined) (square true))`
    );
    expect(target.getAttribute('variant')).toBe('outlined');
    expect(target.hasAttribute('square')).toBe(true);
  });
});

describe('card', () => {
  it('is a group named by its title', async () => {
    const { target, document } = await mountOne(`(x: card Starter
    (subtitle 'For one')
    (variant outlined)
    (y: text Body))`);
    expect(target.getAttribute('role')).toBe('group');
    expect(
      document.getElementById(target.getAttribute('aria-labelledby'))
        .textContent
    ).toBe('Starter');
    expect(target.querySelector('[data-part="subtitle"]').textContent).toBe(
      'For one'
    );
    expect(target.querySelector('[data-part="content"]').textContent).toBe(
      'Body'
    );
    expect(target.getAttribute('variant')).toBe('outlined');
  });

  it('has no group role or header without a title', async () => {
    const { target } = await mountOne(`(x: card (y: text Body))`);
    expect(target.hasAttribute('role')).toBe(false);
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    expect(target.querySelector('[data-part="header"]').hidden).toBe(true);
  });
});

describe('app-bar', () => {
  it('draws a native header with a title and its children', async () => {
    const { target } = await mountOne(`(x: app-bar Inbox
    (y: text Three))`);
    const root = target.querySelector('[data-part="root"]');
    expect(root.localName).toBe('header');
    expect(root.querySelector('[data-part="title"]').textContent).toBe('Inbox');
    expect(root.querySelector('[data-part="content"]').textContent).toBe(
      'Three'
    );
    expect(target.getAttribute('position')).toBe('static');
    expect(target.getAttribute('tone')).toBe('surface');
  });

  it('takes a position and a tone, ignoring unknown values', async () => {
    const good = await mountOne(
      `(x: app-bar A (position sticky) (tone primary))`
    );
    expect(good.target.getAttribute('position')).toBe('sticky');
    expect(good.target.getAttribute('tone')).toBe('primary');
    const bad = await mountOne(`(x: app-bar A (position floating))`);
    expect(bad.target.getAttribute('position')).toBe('static');
  });
});

describe('surface documentation', () => {
  const entries = pkg('src/layout/catalog.lino');

  for (const kind of SURFACES) {
    it(`${kind} has a kind, vocabulary, catalog entry and story`, async () => {
      expect(getKind(kind)).toBeTruthy();
      expect(layoutVocabulary().kinds.has(kind)).toBe(true);
      expect(entries).toContain(`  kind ${kind}\n`);
      expect(entries).toContain(`packages/ui-components/stories/${kind}.lino`);
      const set = parseStories(pkg(`stories/${kind}.lino`));
      expect(set.component).toBe(kind);
      expect(set.stories.length).toBeGreaterThan(0);
    });
  }

  it('renders to static HTML', () => {
    const html = renderToHTML(
      parse(`(x: card Starter (y: text Body))`, {
        vocabulary: layoutVocabulary(),
      })
    );
    expect(html).toContain('<ui-card');
    expect(html).toContain('Starter');
    expect(html).toContain('Body');
  });
});
