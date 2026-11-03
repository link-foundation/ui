/**
 * Diagram model → Mermaid text.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  escapeMermaidLabel,
  parseDiagram,
  toMermaid,
} from '@link-foundation/ui-components/diagrams';
import { fixture } from './fixtures.js';

describe('toMermaid', () => {
  it('returns exactly the Mermaid text of the issue for the login flow', () => {
    expect(toMermaid(parseDiagram(fixture('login-flow.lino')))).toBe(
      fixture('login-flow.mmd')
    );
    expect(fixture('login-flow.mmd')).toBe(
      [
        'flowchart TD',
        '  start["Start"]',
        '  check{"Signed in?"}',
        '  home["Home"]',
        '  start --> check',
        '  check -->|yes| home',
      ].join('\n')
    );
  });

  it('writes state diagrams with start and end states and nested groups', () => {
    expect(toMermaid(parseDiagram(fixture('order-state.lino')))).toBe(
      [
        'stateDiagram-v2',
        '  direction LR',
        '  state "Active" as active {',
        '    state "Paying" as paying {',
        '      state "Payment pending" as pending',
        '      state "Paid" as paid',
        '    }',
        '    state "In cart" as cart',
        '  }',
        '  state "Shipped" as shipped',
        '  [*] --> cart',
        '  cart --> pending : check out',
        '  pending --> paid : card accepted',
        '  pending --> cart : card declined',
        '  paid --> shipped',
        '  shipped --> [*]',
      ].join('\n')
    );
  });

  it('writes flowchart groups as subgraphs', () => {
    const model = parseDiagram(
      "(f: diagram (direction right) (g: group (label 'Auth')) (a: node (group g)) (b: node (shape stadium)) (edge (from a) (to b)))"
    );
    expect(toMermaid(model)).toBe(
      [
        'flowchart LR',
        '  subgraph g ["Auth"]',
        '    a["a"]',
        '  end',
        '  b(["b"])',
        '  a --> b',
      ].join('\n')
    );
  });

  it('writes sequence and class diagrams', () => {
    expect(toMermaid(parseDiagram(fixture('sign-in-sequence.lino')))).toBe(
      [
        'sequenceDiagram',
        '  participant user as User',
        '  participant app as App',
        '  participant server as Links server',
        '  user->>app: types a password',
        '  app->>server: POST /session',
        '  server->>app: token',
        '  app->>user: shows home',
      ].join('\n')
    );
    expect(toMermaid(parseDiagram(fixture('links-class.lino')))).toBe(
      [
        'classDiagram',
        '  direction LR',
        '  class link["Link"]',
        '  class doublet["Doublet"]',
        '  class triplet["Triplet"]',
        '  doublet --> link : is a',
        '  triplet --> link : is a',
      ].join('\n')
    );
  });

  it('escapes labels and replaces ids Mermaid cannot read', () => {
    expect(toMermaid(parseDiagram(fixture('tricky-labels.lino')))).toBe(
      [
        'flowchart RL',
        '  n_end["It\'s #quot;quoted#quot; #lt;b#gt;bold#lt;/b#gt; #38; #35;1"]',
        '  n_a_b(("a:b (c)"))',
        '  a_b["underscore"]',
        '  n_end -->|"#lt;script#gt;#124;pipe#124;"| n_a_b',
        '  n_a_b --> a_b',
        '  n_a_b -->|second| a_b',
      ].join('\n')
    );
  });

  it('keeps generated ids unique', () => {
    const model = parseDiagram(
      '(f: diagram (a.b: node) (a-b: node) (n_a_b: node) (edge (from a.b) (to a-b)))'
    );
    expect(toMermaid(model).split('\n').slice(1, 4)).toEqual([
      '  n_a_b_2["a.b"]',
      '  n_a_b_3["a-b"]',
      '  n_a_b["n_a_b"]',
    ]);
  });

  it('escapes every character that could end a quoted label', () => {
    expect(escapeMermaidLabel('a"b<c>d&e#f|g\nh')).toBe(
      'a#quot;b#lt;c#gt;d#38;e#35;f#124;g h'
    );
  });

  it('rejects an unknown kind', () => {
    expect(() => toMermaid({ kind: 'gantt' })).toThrow(TypeError);
  });
});
