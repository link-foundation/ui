import { describe, it, expect } from 'test-anywhere';
import {
  buildNetwork,
  networkEdges,
} from '../../../src/links-view/network-model.js';
import { circle } from '../../../src/links-view/layouts/circle.js';
import { grid } from '../../../src/links-view/layouts/grid.js';
import { hex } from '../../../src/links-view/layouts/hex.js';
import { spiral } from '../../../src/links-view/layouts/spiral.js';
import {
  force,
  createForceSimulation,
} from '../../../src/links-view/layouts/force.js';
import { layered } from '../../../src/links-view/layouts/layered.js';
import { visibleLabels } from '../../../src/links-view/labels.js';
import { createLayoutRunner } from '../../../src/links-view/create-layout-runner.js';
import {
  networkGeometry,
  networkShapes,
} from '../../../src/links-view/network-scene.js';
import { runLayoutJob } from '../../../src/links-view/layout-worker.js';
import { createAnimator } from '../../../src/links-view/animator.js';

const input = [
  { id: 'a', source: 'p', target: 'p' },
  { id: 'b', source: 'a', target: 'c' },
  { id: 'c', source: 'b', target: 0 },
];

describe('network model and deterministic layouts', () => {
  it('distinguishes points, link references, cycles and free ends', () => {
    const network = buildNetwork(input);
    expect([...network.links.keys()]).toEqual(['a', 'b', 'c']);
    expect([...network.points.keys()]).toEqual(['p']);
    expect(network.links.get('c').target).toBe(0);
    expect(networkEdges(network).length).toBe(5);
    expect(() => buildNetwork([input[0], input[0]])).toThrow();
  });
  for (const layout of [circle, grid, hex, spiral, force, layered]) {
    it(`${layout.name} is repeatable, finite, complete and pure`, () => {
      const network = buildNetwork(input);
      const options = { width: 600, height: 400 };
      const a = layout(network, options);
      const b = layout(network, options);
      expect([...a]).toEqual([...b]);
      expect(a.size).toBe(4);
      expect([...a.values()].every((p) => Number.isFinite(p.x + p.y))).toBe(
        true
      );
      expect(layout(buildNetwork([]), options).size).toBe(0);
      expect([...network.points.values()].every((p) => p.x === undefined)).toBe(
        true
      );
    });
  }
  it('anchors references and loops without recursion and reuses unchanged geometry', () => {
    const network = buildNetwork(input);
    const positions = circle(network);
    const shapes = networkShapes(network, positions);
    const geometry = networkGeometry(network.links.get('b'), positions);
    expect(geometry.source).toBe(positions.get('a'));
    expect(geometry.target).toBe(positions.get('c'));
    const loop = networkGeometry(
      { id: 'a', source: 'a', target: 'a' },
      positions
    );
    expect(loop.path[0].p0).toEqual(positions.get('a'));
    expect(loop.path.at(-1).p3).toEqual(positions.get('a'));
    expect(loop.points.some((p) => p.x !== positions.get('a').x)).toBe(true);
    const updated = buildNetwork([
      ...input,
      { id: 'd', source: 'p', target: 0 },
    ]);
    positions.set('d', { x: 20, y: 20 });
    expect(networkShapes(updated, positions, 'glyph', shapes).get('a')).toBe(
      shapes.get('a')
    );
    positions.set('p', { x: 30, y: 30 });
    expect(
      networkShapes(updated, positions, 'glyph', shapes).get('a')
    ).not.toBe(shapes.get('a'));
  });
  it('preserves dragged pins in every worker layout', () => {
    for (const layout of [
      'circle',
      'grid',
      'hex',
      'spiral',
      'force',
      'layered',
    ]) {
      const result = runLayoutJob({
        key: 'layout',
        id: 1,
        job: {
          layout,
          links: input,
          options: { pins: [['a', { x: 123, y: 87 }]] },
        },
      });
      expect(new Map(result.positions).get('a')).toEqual({ x: 123, y: 87 });
    }
  });
  it('force stops at 300 ticks and the injected animator becomes idle', () => {
    const simulation = createForceSimulation(buildNetwork(input), {
      maxTicks: 1000,
    });
    const frames = [];
    const animator = createAnimator({
      raf: (fn) => {
        frames.push(fn);
        return frames.length;
      },
      caf: () => {},
      now: () => 0,
      reducedMotion: () => false,
    });
    animator.start('layout', () => simulation.tick());
    let ticks = 0;
    while (frames.length && ticks < 301) {
      frames.shift()();
      ticks++;
    }
    expect(ticks <= 300).toBe(true);
    expect(simulation.ticks <= 300).toBe(true);
    expect(animator.isRunning()).toBe(false);
    expect(frames.length).toBe(0);
  });
});

describe('labels and layout jobs', () => {
  it('hides labels below the threshold and greedily avoids padded overlaps', () => {
    const labels = [
      { id: 'low', x: 0, y: 0, width: 20, height: 10, priority: 0 },
      { id: 'high', x: 0, y: 0, width: 20, height: 10, priority: 2 },
      { id: 'near', x: 22, y: 0, width: 20, height: 10 },
      { id: 'far', x: 50, y: 0, width: 20, height: 10 },
    ];
    expect(visibleLabels(labels, 0.5, { minZoom: 0.6, padding: 2 })).toEqual(
      []
    );
    expect(visibleLabels(labels, 1, { padding: 2 })).toEqual(['high', 'far']);
  });
  it('cancels old jobs, drops stale results, isolates keys and disposes', async () => {
    const workers = [];
    const runner = createLayoutRunner({
      createWorker: () => {
        const listeners = {};
        const worker = {
          addEventListener: (type, fn) => {
            listeners[type] = fn;
          },
          postMessage: (data) => {
            worker.sent = data;
          },
          terminate: () => {
            worker.terminated = true;
          },
          reply: (data) => listeners.message({ data }),
        };
        workers.push(worker);
        return worker;
      },
    });
    const old = runner
      .run('view', { layout: 'circle', links: input })
      .catch((e) => e.name);
    const next = runner.run('view', { layout: 'grid', links: input });
    const other = runner.run('other', { layout: 'hex', links: input });
    expect(await old).toBe('AbortError');
    expect(workers[0].terminated).toBe(true);
    let settled = false;
    next.then(() => {
      settled = true;
    });
    workers[0].reply({
      ...workers[0].sent,
      positions: [['old', { x: 0, y: 0 }]],
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    workers[1].reply({
      ...workers[1].sent,
      positions: [['new', { x: 1, y: 2 }]],
    });
    expect([...(await next).positions.keys()]).toEqual(['new']);
    const cancelled = other.catch((e) => e.name);
    runner.cancel('other');
    expect(await cancelled).toBe('AbortError');
    runner.dispose();
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(await runner.run('late', {}).catch((e) => e.name)).toBe(
      'AbortError'
    );
  });
});
