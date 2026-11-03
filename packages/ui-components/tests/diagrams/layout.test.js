/**
 * The Dagre layout and layout plugins: same coordinates on every run, no two
 * node boxes overlapping, and plugins checked before they are used.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  DEFAULT_LAYOUT,
  estimateNodeSize,
  layoutDiagram,
  parseDiagram,
  registerLayout,
  registeredLayouts,
  runLayout,
  unregisterLayout,
} from '@link-foundation/ui-components/diagrams';
import { fixture, linoFixtures } from './fixtures.js';

/** Whether two centred boxes share any area. */
const overlap = (a, b) =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width &&
  Math.abs(a.y - b.y) * 2 < a.height + b.height;

describe('layoutDiagram', () => {
  for (const { name, text } of linoFixtures()) {
    const model = parseDiagram(text);

    it(`gives the same coordinates on two runs for ${name}`, () => {
      expect(layoutDiagram(model)).toEqual(layoutDiagram(parseDiagram(text)));
    });

    it(`lets no two nodes of ${name} overlap`, () => {
      const { nodes, width, height } = layoutDiagram(model);
      expect(nodes.map((box) => box.id)).toEqual(model.nodes.map((n) => n.id));
      for (const [i, a] of nodes.entries()) {
        expect(a.x - a.width / 2 >= 0 && a.x + a.width / 2 <= width).toBe(true);
        expect(a.y - a.height / 2 >= 0 && a.y + a.height / 2 <= height).toBe(
          true
        );
        for (const b of nodes.slice(i + 1)) {
          expect(overlap(a, b)).toBe(false);
        }
      }
    });
  }

  it('places the login flow top to bottom with labelled edges', () => {
    const layout = layoutDiagram(parseDiagram(fixture('login-flow.lino')));
    const [start, check, home] = layout.nodes;
    expect(start.y < check.y && check.y < home.y).toBe(true);
    expect(layout.edges.map((edge) => edge.id)).toEqual(['edge-1', 'edge-2']);
    expect(layout.edges[0].labelAt).toBeNull();
    expect(layout.edges[1].labelAt === null).toBe(false);
    for (const edge of layout.edges) {
      expect(edge.points.length >= 2).toBe(true);
    }
  });

  it('follows the direction and keeps grouped nodes inside their group', () => {
    const model = parseDiagram(fixture('order-state.lino'));
    const layout = layoutDiagram(model);
    const at = new Map(layout.nodes.map((box) => [box.id, box]));
    expect(at.get('cart').x < at.get('shipped').x).toBe(true);
    const active = layout.groups.find((box) => box.id === 'active');
    for (const id of ['cart', 'pending', 'paid']) {
      const box = at.get(id);
      expect(Math.abs(box.x - active.x) * 2 <= active.width).toBe(true);
      expect(Math.abs(box.y - active.y) * 2 <= active.height).toBe(true);
    }
  });

  it('uses a given node size', () => {
    const model = parseDiagram('(f: diagram (a: node) (b: node))');
    const layout = layoutDiagram(model, {
      nodeSize: { width: 100, height: 50 },
    });
    expect(layout.nodes[0].width).toBe(100);
    expect(layout.nodes[0].height).toBe(50);
  });

  it('sizes nodes from their labels', () => {
    const box = estimateNodeSize({ label: 'A long label', shape: 'box' });
    expect(box).toEqual({ width: 128, height: 40 });
    expect(estimateNodeSize({ label: '', shape: 'start' })).toEqual({
      width: 24,
      height: 24,
    });
  });
});

describe('layout plugins', () => {
  const model = parseDiagram('(f: diagram (a: node) (b: node))');
  const fixed = () => ({
    width: 200,
    height: 100,
    nodes: [
      { id: 'a', x: 50, y: 50, width: 40, height: 40 },
      { id: 'b', x: 150, y: 50, width: 40, height: 40 },
    ],
  });

  it('uses Dagre by default', async () => {
    expect(DEFAULT_LAYOUT).toBe('dagre');
    expect(await runLayout(model)).toEqual(layoutDiagram(model));
  });

  it('runs a registered engine picked by name or by (layout NAME)', async () => {
    registerLayout('fixed', fixed);
    try {
      expect(registeredLayouts()).toEqual(['dagre', 'fixed']);
      expect((await runLayout(model, {}, 'fixed')).width).toBe(200);
      const picked = parseDiagram(
        '(f: diagram (layout fixed) (a: node) (b: node))'
      );
      expect((await runLayout(picked)).groups).toEqual([]);
    } finally {
      expect(unregisterLayout('fixed')).toBe(true);
    }
    expect(unregisterLayout('dagre')).toBe(false);
  });

  it('rejects an unknown engine and a malformed layout', async () => {
    const message = async (promise) => {
      try {
        await promise;
      } catch (error) {
        return error.message;
      }
      return null;
    };
    expect(await message(runLayout(model, {}, 'elk'))).toBe(
      'unknown layout "elk" (registered: dagre)'
    );
    registerLayout('broken', () => ({ ...fixed(), nodes: [] }));
    try {
      expect(await message(runLayout(model, {}, 'broken'))).toBe(
        'layout "broken" returned no box for node "a"'
      );
    } finally {
      unregisterLayout('broken');
    }
    expect(() => registerLayout('', fixed)).toThrow();
    expect(() => registerLayout('x', null)).toThrow();
  });
});
