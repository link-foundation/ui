/**
 * Behaviour: a `link-view` is read from Links Notation with the ui-core
 * parser into a frozen model, with diagnostics for what it cannot use, and
 * gets an accessible name such as "Link 1 from 1 to 2".
 */

import { describe, it, expect } from 'test-anywhere';
import {
  FREE_END_MARKER,
  accessibleName,
  parseLinkView,
  readLinkView,
} from '../../src/links-view/model.js';

const ISSUE_EXAMPLE = `(simple: link-view
  (link (id 1) (source 1) (target 2))
  (markers (source bar) (target arrow))
  (blueprint true)
  (grid true))`;

const codes = (read) => read.diagnostics.map((d) => d.code);

describe('parseLinkView', () => {
  it('reads the example of the issue', () => {
    const { model, diagnostics } = parseLinkView(ISSUE_EXAMPLE);
    expect(diagnostics).toEqual([]);
    expect(model).toEqual({
      name: 'simple',
      id: '1',
      source: '1',
      target: '2',
      ends: { source: 'bar', target: 'arrow' },
      blueprint: true,
      grid: true,
      bend: 0,
      label: null,
      selfLoop: false,
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(accessibleName(model)).toBe('Link 1 from 1 to 2');
  });

  it('reads an unnamed and an indented link-view', () => {
    const unnamed = parseLinkView(
      '(link-view (link (id 7) (source 3) (target 4)))'
    );
    expect(accessibleName(unnamed.model)).toBe('Link 7 from 3 to 4');
    const indented = parseLinkView(
      'link-view\n  link\n    id 4\n    source 1\n    target 2\n  bend 0.5'
    );
    expect(indented.diagnostics).toEqual([]);
    expect(indented.model.bend).toBe(0.5);
    expect(accessibleName(indented.model)).toBe('Link 4 from 1 to 2');
  });

  it('reads a self-loop', () => {
    const { model } = parseLinkView(
      '(loop: link-view (link (id 2) (source 3) (target 3)))'
    );
    expect(model.selfLoop).toBe(true);
    expect(accessibleName(model)).toBe('Link 2 from 3 to 3, a self-loop');
  });

  it('gives a free end a cross marker', () => {
    const { model } = parseLinkView(
      '(free: link-view (link (id 3) (source 1) (target 0)))'
    );
    expect(model.target).toBe(null);
    expect(model.ends).toEqual({ source: 'bar', target: FREE_END_MARKER });
    expect(accessibleName(model)).toBe('Link 3 from 1 to a free end');
  });

  it('uses an explicit label as the accessible name', () => {
    const { model } = parseLinkView(
      "(named: link-view (link (id 1) (source 1) (target 2)) (label 'Mother of'))"
    );
    expect(accessibleName(model)).toBe('Mother of');
  });

  it('reports a text with no link-view', () => {
    const read = parseLinkView('(page: column)');
    expect(codes(read)).toContain('missing-link-view');
    expect(accessibleName(read.model)).toBe(
      'Link from a free end to a free end'
    );
  });
});

describe('readLinkView', () => {
  it('reports unknown markers and invalid values, and keeps defaults', () => {
    const read = readLinkView([
      ['link', ['id', '1'], ['source', '1'], ['target', '2']],
      ['markers', ['source', 'star'], ['target', 'dot']],
      ['blueprint', 'maybe'],
      ['bend', 'far'],
    ]);
    expect(codes(read)).toEqual([
      'unknown-marker',
      'invalid-value',
      'invalid-value',
    ]);
    expect(read.model.ends).toEqual({ source: 'bar', target: 'dot' });
    expect(read.model.blueprint).toBe(false);
    expect(read.model.bend).toBe(0);
  });

  it('reports a missing link', () => {
    expect(codes(readLinkView([['grid', 'true']]))).toEqual(['missing-link']);
  });

  it('keeps the name it is given', () => {
    expect(readLinkView([], { name: 'x' }).model.name).toBe('x');
  });
});
