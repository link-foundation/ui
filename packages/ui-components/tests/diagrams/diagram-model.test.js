/**
 * The diagram dialect: reading a diagram written in Links Notation into a
 * model, writing it back, and the errors of invalid diagrams.
 */

import { describe, it, expect } from 'test-anywhere';
import { Parser } from 'links-notation';
import {
  DiagramError,
  describeDiagram,
  diagramFromLinks,
  diagramToLino,
  diagramsFromLinks,
  parseDiagram,
} from '@link-foundation/ui-components/diagrams';
import { fixture, linoFixtures } from './fixtures.js';

const parse = (text) => new Parser().parse(text);

/** The DiagramError thrown by `fn` (fails when nothing is thrown). */
function errorOf(fn) {
  try {
    fn();
  } catch (error) {
    expect(error instanceof DiagramError).toBe(true);
    return error;
  }
  throw new Error('expected a DiagramError');
}

describe('diagramFromLinks', () => {
  it('reads the login flow of the issue', () => {
    const model = diagramFromLinks(parse(fixture('login-flow.lino')));
    expect(model).toEqual({
      id: 'login-flow',
      kind: 'flowchart',
      direction: 'down',
      label: null,
      renderer: null,
      layout: null,
      nodes: [
        { id: 'start', label: 'Start', shape: 'box', group: null },
        { id: 'check', label: 'Signed in?', shape: 'diamond', group: null },
        { id: 'home', label: 'Home', shape: 'box', group: null },
      ],
      edges: [
        { id: 'edge-1', from: 'start', to: 'check', label: null },
        { id: 'edge-2', from: 'check', to: 'home', label: 'yes' },
      ],
      groups: [],
    });
  });

  it('gives the same model for the one-line and the multi-line form', () => {
    const oneLine = parseDiagram(
      "(f: diagram (kind state) (a: node (label 'A b')) (edge (from a) (to a)))"
    );
    const multiLine = parseDiagram(
      "(f: diagram\n  (kind state)\n  (a: node\n    (label 'A b'))\n  (edge (from a)\n    (to a)))"
    );
    expect(multiLine).toEqual(oneLine);
    expect(oneLine.nodes[0].label).toBe('A b');
  });

  it('reads groups, nested groups, settings and named edges', () => {
    const model = parseDiagram(fixture('order-state.lino'));
    expect(model.kind).toBe('state');
    expect(model.direction).toBe('right');
    expect(model.label).toBe('Order lifecycle');
    expect(model.groups).toEqual([
      { id: 'active', label: 'Active', group: null },
      { id: 'paying', label: 'Paying', group: 'active' },
    ]);
    expect(model.edges[1].id).toBe('checkout');
    expect(model.edges[2].id).toBe('edge-3');
  });

  it('lists every diagram of a document', () => {
    const models = diagramsFromLinks(
      parse('(a: diagram (x: node))\n(note text)\n(b: diagram (y: node))')
    );
    expect(models.map((model) => model.id)).toEqual(['a', 'b']);
  });
});

describe('diagramToLino', () => {
  for (const { name, text } of linoFixtures()) {
    it(`round-trips ${name}`, () => {
      const model = diagramFromLinks(parse(text));
      expect(diagramFromLinks(parse(diagramToLino(model)))).toEqual(model);
    });
  }

  it('writes the multi-line form and leaves out default values', () => {
    expect(diagramToLino(parseDiagram(fixture('login-flow.lino')))).toBe(
      [
        '(login-flow: diagram',
        '  (kind flowchart)',
        '  (direction down)',
        '  (start: node (label Start))',
        "  (check: node (label 'Signed in?') (shape diamond))",
        '  (home: node (label Home))',
        '  (edge (from start) (to check))',
        '  (edge (from check) (to home) (label yes)))',
        '',
      ].join('\n')
    );
  });
});

describe('errors', () => {
  it('names the position of an edge to an unknown node', () => {
    const error = errorOf(() =>
      parseDiagram(
        '(f: diagram\n  (a: node)\n  (edge (from a) (to a))\n  (edge (from a) (to b)))'
      )
    );
    expect(error.code).toBe('unknown-node');
    expect(error.at).toEqual({
      diagram: 'f',
      path: [0, 3],
      link: '(edge (from a) (to b))',
    });
    expect(error.message).toBe(
      'link 3 of diagram "f": unknown node "b" in (edge (from a) (to b))'
    );
  });

  it('counts the diagram link among the other links of the document', () => {
    const error = errorOf(() =>
      diagramFromLinks(parse('(note)\n(f: diagram (edge (from x) (to x)))'))
    );
    expect(error.at.path).toEqual([1, 1]);
  });

  for (const [text, code] of [
    ['(note text)', 'no-diagram'],
    ['(f: diagram (kind gantt))', 'invalid-value'],
    ['(f: diagram (direction sideways))', 'invalid-value'],
    ['(f: diagram (renderer canvas))', 'invalid-value'],
    ['(f: diagram (a: node (shape blob)))', 'invalid-value'],
    ['(f: diagram (a: node (colour red)))', 'unknown-property'],
    ['(f: diagram (a: node (group nowhere)))', 'unknown-group'],
    ['(f: diagram (a: node) (a: node))', 'duplicate-id'],
    ['(f: diagram (a: node (label x) (label y)))', 'duplicate-id'],
    ['(f: diagram (node (label x)))', 'missing-value'],
    ['(f: diagram (a: node) (edge (from a)))', 'missing-value'],
    ['(f: diagram (box a))', 'unknown-property'],
    ['(f: diagram (g: group (group h)) (h: group (group g)))', 'invalid-value'],
  ]) {
    it(`reports ${code} for ${text}`, () => {
      expect(errorOf(() => parseDiagram(text)).code).toBe(code);
    });
  }
});

describe('describeDiagram', () => {
  it('says which node leads to which', () => {
    expect(describeDiagram(parseDiagram(fixture('login-flow.lino')))).toEqual({
      nodes: ['Start', 'Signed in?', 'Home'],
      edges: ['Start leads to Signed in?', 'Signed in? leads to Home (yes)'],
    });
  });
});
