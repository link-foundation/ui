/**
 * Our SVG renderer: deterministic, escaped and labelled for screen readers.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  diagramSummary,
  escapeXml,
  layoutDiagram,
  parseDiagram,
  renderDiagramSvg,
} from '@link-foundation/ui-components/diagrams';
import { fixture } from './fixtures.js';

const draw = (name, tokens) => {
  const model = parseDiagram(fixture(name));
  return renderDiagramSvg(model, layoutDiagram(model), tokens);
};

describe('renderDiagramSvg', () => {
  it('draws the login flow the same way twice', () => {
    expect(draw('login-flow.lino')).toBe(draw('login-flow.lino'));
  });

  it('labels the drawing for screen readers', () => {
    const svg = draw('login-flow.lino', { idPrefix: 'login' });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain(
      'aria-label="Flowchart login-flow: 3 nodes, 2 connections"'
    );
    expect(svg).toContain('id="login-arrow"');
    for (const id of ['start', 'check', 'home']) {
      expect(svg).toContain(`data-id="${id}"`);
    }
    expect(svg).toContain('>Signed in?</text>');
    expect(svg).toContain('>yes</text>');
  });

  it('escapes every label', () => {
    const svg = draw('tricky-labels.lino');
    expect(svg.includes('<b>')).toBe(false);
    expect(svg.includes('<script>')).toBe(false);
    expect(svg).toContain(
      'It&#39;s &quot;quoted&quot; &lt;b&gt;bold&lt;/b&gt; &amp; #1'
    );
    expect(svg).toContain('&lt;script&gt;|pipe|');
  });

  it('draws groups, and states with start and end markers', () => {
    const svg = draw('order-state.lino');
    expect(svg).toContain('class="ui-diagram-group" data-id="active"');
    expect(svg).toContain('class="ui-diagram-group" data-id="paying"');
    expect(svg).toContain('<circle'); // the start and end states
    expect(svg).toContain('aria-label="State diagram Order lifecycle');
  });

  it('uses design tokens and rejects unsafe token values', () => {
    expect(draw('login-flow.lino')).toContain('var(--color-surface, #fffbfe)');
    const svg = draw('login-flow.lino', { surface: '#ff0000', fontSize: 16 });
    expect(svg).toContain('fill:#ff0000');
    expect(svg).toContain('font-size:16px');
    expect(svg).toContain('font-size:14px'); // edge labels: 2 px smaller
    expect(() => draw('login-flow.lino', { accent: 'red;}<' })).toThrow();
    expect(() => draw('login-flow.lino', { fontSize: 'big' })).toThrow();
  });

  it('refuses kinds it does not draw', () => {
    expect(() => draw('sign-in-sequence.lino')).toThrow();
  });
});

describe('helpers', () => {
  it('escapes XML text and attributes', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
  });

  it('summarises a diagram', () => {
    expect(diagramSummary(parseDiagram('(f: diagram (a: node))'))).toBe(
      'Flowchart f: 1 node, 0 connections'
    );
  });
});
