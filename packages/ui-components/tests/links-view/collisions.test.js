import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDoubletProvider,
  createCollisionSolver,
  createNetworkEditorProvider,
  createNetworkPresentation,
  doubletGeometry,
  networkOptionsFromLino,
  networkOptionsToLino,
  scorePaintedCollisions,
  solveCollisions,
} from '@link-foundation/ui-components/links-view';
import { rendererOptions } from '../../src/links-view/network-editor/renderer-options.js';
import { paintDoublet } from '../../src/links-view/painted-collisions.js';

const reciprocal = [
  [2, 2],
  [1, 1],
];
const cleanOptions = readFileSync(
  new globalThis.URL('./fixtures/doublet-22-11-clean.lino', import.meta.url),
  'utf8'
);

function verifyScore(links, options, result) {
  const p = createNetworkPresentation(
    createNetworkEditorProvider({ Worker: undefined })
  );
  return p
    .update({
      items: links,
      options: networkOptionsToLino({
        ...options,
        turns: result.turns,
        linkGaps: result.linkGaps,
        frame: result.frame,
      }),
    })
    .then(() => {
      assert.equal(
        scorePaintedCollisions(p.snapshot().frame).count,
        result.after
      );
      p.dispose();
    });
}

test('solves 22 11 with opposing turns above 30 degrees, unchanged gaps and pinned fit', async () => {
  const result = solveCollisions(reciprocal);
  const original = doubletGeometry(reciprocal);
  assert.equal(result.before, scorePaintedCollisions(original).count);
  assert.ok(result.before > 0);
  assert.equal(result.after, 0);
  assert.deepEqual(result.frame, original.transform);
  assert.deepEqual(result.linkGaps, []);
  assert.ok(result.turns[0][0] * result.turns[0][1] < 0);
  assert.ok(Math.max(...result.turns[0].map(Math.abs)) > 30);
  await verifyScore(reciprocal, {}, result);
});

test('returns the shared clean 22 11 fixture unchanged', () => {
  const result = solveCollisions(reciprocal, cleanOptions);
  assert.equal(result.before, 0);
  assert.equal(result.after, 0);
  assert.deepEqual(result.turns, [[-90, 90]]);
  assert.deepEqual(result.linkGaps, []);
  assert.equal(result.frame, null);
  assert.deepEqual(result.delta, [
    [0, 0],
    [0, 0],
  ]);
});

test('rejects a turn that would paint outside the pinned frame', () => {
  const [scale, x, y] = doubletGeometry(reciprocal).transform;
  const frame = [scale, x, y + 18];
  const bottom = (options) => {
    const text = rendererOptions(options, reciprocal.length);
    const { curves, options: fitted } = doubletGeometry(reciprocal, text);
    return Math.max(
      ...curves.map((curve) => paintDoublet(curve, fitted, 1).bounds.maxY)
    );
  };
  assert.ok(bottom({ frame }) < 100);
  const result = solveCollisions(reciprocal, { frame });
  assert.ok(result.after < result.before);
  assert.deepEqual(result.frame, frame);
  assert.ok(bottom(result) <= 100);
});

test('a host renderer supplies both the search geometry and the pinned fit', () => {
  const geometry = (links, options) => {
    const entries = Object.values(options.links);
    const fitted = doubletGeometry(
      links,
      rendererOptions(
        {
          frame: options.frame ?? [45, 51, 52],
          turns: entries.map((entry) => entry.turns),
          linkGaps: entries.map((entry) => entry.gaps),
        },
        links.length
      )
    );
    return { ...fitted, bounds: undefined };
  };
  const fitted = doubletGeometry(reciprocal, 'frame: 45 51 52');
  const result = solveCollisions(reciprocal, {}, { geometry });
  assert.equal(result.before, scorePaintedCollisions(fitted).count);
  assert.equal(result.after, 0);
  assert.deepEqual(result.frame, fitted.transform);
  const committed = rendererOptions(result, reciprocal.length);
  assert.equal(
    scorePaintedCollisions(doubletGeometry(reciprocal, committed)).count,
    result.after
  );
  const disabled = solveCollisions(
    reciprocal,
    { solveRange: 0, solveGaps: false },
    { geometry }
  );
  assert.equal(disabled.after, disabled.before);
  assert.deepEqual(disabled.turns, []);
});

test('22 22 and 11 11 mirror turns and keep equal gaps at the closed link', async () => {
  for (const [links, i] of [
    [
      [
        [2, 2],
        [2, 2],
      ],
      0,
    ],
    [
      [
        [1, 1],
        [1, 1],
      ],
      1,
    ],
  ]) {
    const result = solveCollisions(links);
    assert.ok(result.after < result.before);
    assert.ok(result.turns[i][0] !== 0);
    assert.equal(result.turns[i][0], -result.turns[i][1]);
    assert.ok(Math.abs(result.delta[i][0]) <= 30);
    assert.equal(result.linkGaps[i]?.[0], result.linkGaps[i]?.[1]);
    assert.deepEqual(result.delta[1 - i], [0, 0]);
    await verifyScore(links, {}, result);
  }
});

test('tries gap fallback in a narrow range, and solves with gaps disabled in the full range', async () => {
  const result = solveCollisions(reciprocal, { solveRange: 30 });
  assert.ok(
    result.linkGaps.some((gaps) => gaps.some((value) => value !== null))
  );
  assert.ok(result.after < result.before);
  await verifyScore(reciprocal, { solveRange: 30 }, result);
  const turnsOnly = solveCollisions(reciprocal, { solveGaps: false });
  assert.equal(turnsOnly.after, 0);
  assert.deepEqual(turnsOnly.linkGaps, []);
});

test('scores new gaps at the precision the host can save', async () => {
  const options = { solveRange: 30, solveGapRange: 0.19543 };
  const result = solveCollisions(reciprocal, options, { gapPrecision: 3 });
  const gaps = result.linkGaps.flat().filter((gap) => gap !== null);
  assert.ok(gaps.length > 0);
  assert.ok(result.after < result.before);
  assert.deepEqual(
    gaps,
    gaps.map((gap) => Number(gap.toFixed(3)))
  );
  assert.ok(gaps.every((gap) => gap <= 0.08 + options.solveGapRange));
  await verifyScore(reciprocal, options, result);
});

test('the editor provider commits only solved fields to its input and scores the committed frame', async () => {
  const p = createNetworkPresentation(
    createNetworkEditorProvider({ Worker: undefined })
  );
  const options = { color: '#123456', clearance: 1.2, linkColors: ['#111111'] };
  await p.update({
    items: reciprocal,
    options: networkOptionsToLino(options),
    index: '23',
  });
  const before = p.snapshot();
  assert.equal(await p.solve(), true);
  const after = p.snapshot();
  const committed = networkOptionsFromLino(after.input.options);
  assert.equal(after.frame.solution.after, 0);
  assert.equal(scorePaintedCollisions(after.frame).count, 0);
  assert.deepEqual(committed.frame, before.frame.transform);
  assert.equal(committed.clearance, options.clearance);
  assert.equal(committed.color, options.color);
  assert.deepEqual(committed.linkColors, options.linkColors);
  assert.equal(after.input.index, '23');
  assert.match(p.toSvg(), /color="#111111"/);
  p.dispose();
});

test('the doublet provider preserves LiNo style and reuses the solution on a partial update', async () => {
  const p = createNetworkPresentation(
    createDoubletProvider({ Worker: undefined })
  );
  await p.update({
    items: reciprocal,
    options: 'color "#123456"\nsolveGaps false',
  });
  await p.solve();
  const solved = p.snapshot();
  assert.equal(solved.frame.solution.after, 0);
  assert.match(solved.input.options, /solveGaps false/);
  assert.match(p.toSvg(), /#123456/);
  await p.update({ index: '23' });
  assert.deepEqual(p.snapshot().frame.curves, solved.frame.curves);
  p.dispose();
});

test('gaps-only search can cut a middle without shortening a manual cut or crossing the cap', async () => {
  const links = [
    [2, 2],
    [1, 1],
  ];
  const options = {
    frame: [15, 50, 50],
    solveRange: 0,
    solveGapRange: 0,
    solveMiddleRange: 15,
    linkGaps: [[null, null, 7, null]],
  };
  const result = solveCollisions(links, options);
  assert.ok(result.after < result.before);
  assert.deepEqual(result.delta, [
    [0, 0],
    [0, 0],
  ]);
  assert.equal(result.linkGaps[0][2], 7);
  await verifyScore(links, options, result);
  const presentation = createNetworkPresentation(
    createNetworkEditorProvider({ Worker: undefined })
  );
  await presentation.update({
    items: links,
    options: networkOptionsToLino(options),
  });
  const before = scorePaintedCollisions(presentation.snapshot().frame);
  await presentation.solve();
  const { frame } = presentation.snapshot();
  assert.ok(scorePaintedCollisions(frame).cost < before.cost);
  for (const curve of frame.curves) {
    for (let i = 0; i < 2; i++) {
      const manual = options.linkGaps[curve.id - 1]?.[i + 2] ?? 0;
      assert.ok(
        curve.gaps[i + 2] <=
          Math.max(manual, Math.min(30, 0.3 * curve.cutLengths[i]))
      );
    }
  }
  assert.deepEqual(frame.transform, options.frame);
  presentation.dispose();
});

test('seeded networks never increase either the count or the weighted painted cost', async () => {
  let seed = 42;
  const next = (modulo) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % modulo;
  };
  const p = createNetworkPresentation(
    createNetworkEditorProvider({ Worker: undefined })
  );
  for (let n = 1; n <= 6; n++) {
    for (let trial = 0; trial < 3; trial++) {
      const links = Array.from({ length: n }, () => [next(n + 1), next(n + 1)]);
      const options = {
        solveStep: 12,
        passes: 1,
        clearance: next(5),
        turns: links.map(() => [next(360) - 180, next(360) - 180]),
      };
      await p.update({ items: links, options: networkOptionsToLino(options) });
      const original = scorePaintedCollisions(p.snapshot().frame);
      await p.solve();
      const { frame } = p.snapshot();
      const final = scorePaintedCollisions(frame);
      assert.equal(frame.solution.before, original.count);
      assert.equal(frame.solution.after, final.count);
      assert.ok(
        final.count <= original.count && final.cost <= original.cost + 1e-8
      );
      for (const [i, pair] of links.entries()) {
        for (const [side, end] of pair.entries()) {
          if (end === 0 || end === i + 1) {
            assert.equal(frame.solution.delta[i][side], 0);
          }
        }
      }
    }
  }
  p.dispose();
});

test('the public asynchronous job falls back to the same solver and accepts cancellation', async () => {
  const solve = createCollisionSolver({ Worker: undefined });
  assert.deepEqual(
    await solve(reciprocal, cleanOptions),
    solveCollisions(reciprocal, cleanOptions)
  );
  const signal = AbortSignal.abort();
  await assert.rejects(solve(reciprocal, {}, { signal }), {
    name: 'AbortError',
  });
  assert.throws(() => solveCollisions(reciprocal, {}, { signal }), {
    name: 'AbortError',
  });
});

test(
  'dense 24-link search is bounded on one thread and preserves the fitted frame',
  { timeout: 25000 },
  async () => {
    const links = Array.from({ length: 24 }, (_, i) => [
      ((i + 9) % 24) + 1,
      ((i + 14) % 24) + 1,
    ]);
    const started = globalThis.performance.now();
    const result = solveCollisions(links);
    assert.ok(globalThis.performance.now() - started < 20000);
    assert.ok(result.before > 100);
    assert.ok(result.after < result.before);
    await verifyScore(links, {}, result);
  }
);
