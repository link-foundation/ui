import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoubletProvider,
  doubletGeometry,
} from '../../src/links-view/doublet.js';
import { createNetworkPresentation } from '../../src/links-view/presentation.js';
import {
  cubicPoint,
  cubicDerivative,
  distance,
} from '../../src/links-view/geometry.js';

const near = (a, b, tolerance = 1e-6) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const neutral = 'gaps 0 0 0 0';

it('renders 11 22 12 as three continuous two-cubic paths at their own anchors', async () => {
  const p = createNetworkPresentation(createDoubletProvider());
  await p.update({
    items: [
      [1, 1],
      [2, 2],
      [1, 2],
    ],
    options: neutral,
  });
  const { curves, positions } = p.snapshot().frame;
  for (const curve of curves) {
    assert.equal(curve.path.length, 2);
    assert.deepEqual(curve.path[0].p3, positions.get(curve.id));
    const a = cubicDerivative(curve.path[0], 1),
      b = cubicDerivative(curve.path[1], 0);
    near(a.x * b.y - a.y * b.x, 0);
    assert.ok(a.x * b.x + a.y * b.y >= 0);
  }
  const paths = [...p.toSvg().matchAll(/data-link="[^"]+" d="([^"]+)"/gu)];
  assert.equal(paths.length, 3);
  paths.forEach(([, d]) => assert.equal((d.match(/C /gu) ?? []).length, 2));
  assert.match(p.toSvg(), /aria-label="Links network 11 22 12"/u);
});

it('makes the lone double self-loop point-symmetric to within 1e-6', () => {
  const { curves, positions } = doubletGeometry([[1, 1]], neutral);
  const [a, b] = curves[0].path,
    middle = positions.get(1);
  for (let i = 0; i <= 20; i++) {
    const p = cubicPoint(a, i / 20),
      q = cubicPoint(b, 1 - i / 20);
    near(p.x + q.x, 2 * middle.x);
    near(p.y + q.y, 2 * middle.y);
  }
});

it('uses 0.9 lone and 0.42 network free lengths in layout units', () => {
  for (const [items, expected] of [
    [[[0, 0]], 0.9],
    [
      [
        [1, 1],
        [2, 2],
        [1, 0],
      ],
      0.42,
    ],
  ]) {
    const f = doubletGeometry(items, neutral),
      c = f.layoutCurves.at(-1);
    near(distance(c.path[1].p0, c.path[1].p3), expected);
    if (items.length === 1) {
      near(distance(c.path[0].p0, c.path[0].p3), expected);
      near(c.path[0].c1.y, c.path[1].c2.y);
    }
  }
});

it('changes only the requested end directions by exact integer turns', () => {
  const pairs = [
    [2, 2],
    [1, 1],
  ];
  const a = doubletGeometry(pairs, neutral),
    b = doubletGeometry(pairs, `${neutral}\nlink 1\n  turns 30 -30`);
  const angle = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
  for (const [side, expected] of [
    [0, 30],
    [1, -30],
  ]) {
    const t = side ? 1 : 0;
    near(
      angle(cubicDerivative(b.curves[0].path[side], t)) -
        angle(cubicDerivative(a.curves[0].path[side], t)),
      expected
    );
  }
  assert.deepEqual(a.curves[1].path, b.curves[1].path);
});

it('measures all four inheritable gaps as arc length and omits consumed halves', async () => {
  const { segmentLength } = await import('../../src/links-view/geometry.js');
  const f = doubletGeometry(
    [[0, 0]],
    'balanceArrows false\nframe 20 50 50\ngaps 0.1 0.1 0 0\nlink 1\n  gaps 0.2 ~ 5 ~'
  );
  const c = f.curves[0];
  assert.deepEqual(c.gaps, [4, 2, 5, 0]);
  near(segmentLength(c.path[0]) - segmentLength(c.visible[0]), 9);
  near(segmentLength(c.path[1]) - segmentLength(c.visible[1]), 2);
  const consumed = doubletGeometry([[0, 0]], 'frame 2 10 -5\ngaps 0 0 30 0');
  assert.equal(consumed.curves[0].visible[0], null);
  assert.ok(consumed.curves[0].visible[1]);
});

it('uses pinned transforms verbatim and validates every input reference and option boundary', async () => {
  const { readDoubletOptions } =
    await import('../../src/links-view/doublet.js');
  const f = doubletGeometry([[0, 0]], "frame '2 10 -5'");
  assert.deepEqual(f.transform, [2, 10, -5]);
  assert.deepEqual(f.positions.get(1), { x: 10, y: -5 });
  for (const text of [
    'frame 0 0 0',
    'frame 61 0 0',
    'frame 1e-9 0 0',
    'frame 2 Infinity 0',
    'frame 2 1000001 0',
    "frame '2 10 -5\n3 4 5'",
    'tension 2.1',
    'end\n  size 16',
    'start\n  angle 4',
    'end\n  constructor 1',
    'end\n  __proto__ 1',
    'opacity 0',
    'width 4097',
    'card\n  inset 31',
    'caption\n  size 15',
    'columns 1.5',
    'link 1\n  turns 1.5 0',
    'link 1\n  gaps 0 0 31 0',
    'nonsense 1',
    'tension 1\ntension 2',
  ]) {
    assert.throws(() => doubletGeometry([[0, 0]], text), undefined, text);
  }
  for (const items of [
    [[2, 0]],
    [[-1, 0]],
    [[0.5, 0]],
    [[0, 0, 0]],
    [{ id: 2, source: 0, target: 0 }],
  ]) {
    assert.throws(() => doubletGeometry(items));
  }
  assert.equal(
    readDoubletOptions(
      'tension 0\nstrokeWidth 0.5\nopacity 0.1\nwidth 64\nheight 4096',
      1
    ).tension,
    0
  );
  assert.equal(doubletGeometry([]).curves.length, 0);
});

it('permutes circle places, preserves unit spacing, and supplies deterministic placements', () => {
  const items = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  const base = doubletGeometry(items, 'layout circle'),
    permuted = doubletGeometry(items, 'layout circle\norder 3 1 2');
  assert.deepEqual(permuted.places.get(3), base.places.get(1));
  assert.deepEqual(permuted.places.get(1), base.places.get(2));
  near(distance(base.places.get(1), base.places.get(2)), 1);
  for (const bad of ['order 1 1 2', 'order 1 2', 'order 1 2 4']) {
    assert.throws(() => doubletGeometry(items, bad));
  }
  for (const layout of [
    'auto',
    'circle',
    'grid',
    'hex',
    'spiral',
    'dice',
    'cards',
    'force',
    'layered',
  ]) {
    const text = `layout ${layout}\nlayoutAspect 2\ncolumns 3\nspread 1.5\nrotation 90`;
    assert.deepEqual(
      doubletGeometry(items, text),
      doubletGeometry(items, text)
    );
  }
  const cards = doubletGeometry(
    Array.from({ length: 6 }, () => [0, 0]),
    'layout cards'
  );
  near(cards.places.get(1).x, -0.7);
  near(cards.places.get(2).x, 0.7);
  for (let n = 1; n <= 12; n++) {
    const places = doubletGeometry(
      Array.from({ length: n }, () => [0, 0]),
      'layout dice'
    ).places;
    assert.equal(
      new Set([...places.values()].map((p) => `${p.x},${p.y}`)).size,
      n
    );
    if (n > 1 && n <= 6) {
      const points = [...places.values()];
      near(
        Math.min(
          ...points.flatMap((p, i) =>
            points.slice(i + 1).map((q) => distance(p, q))
          )
        ),
        1
      );
    }
  }
});

it('uses middle bisectors, bulge, loop width, tension and mirror lenses', async () => {
  const { sub, scale } = await import('../../src/links-view/geometry.js');
  const { unit, rotate } =
    await import('../../src/links-view/doublet-layout.js');
  const f = doubletGeometry(
      [
        [2, 3],
        [0, 0],
        [0, 0],
      ],
      neutral
    ),
    c = f.layoutCurves[0],
    m = f.places.get(1);
  const incoming = unit(sub(m, f.places.get(2))),
    outgoing = unit(sub(f.places.get(3), m));
  const expected = unit({
    x: incoming.x + outgoing.x,
    y: incoming.y + outgoing.y,
  });
  near(c.direction.x, expected.x);
  near(c.direction.y, expected.y);
  const a = doubletGeometry(
    [
      [2, 0],
      [0, 0],
    ],
    `${neutral}\nbulge 30`
  );
  const d = rotate(unit(sub(a.places.get(1), a.places.get(2))), 30);
  near(a.layoutCurves[0].direction.x, d.x);
  near(a.layoutCurves[0].direction.y, d.y);
  const mirror = doubletGeometry(
    [
      [2, 2],
      [0, 0],
    ],
    `${neutral}\nangles mirror\ntension 0.7`
  );
  const s = mirror.layoutCurves[0].path[0],
    chord = unit(sub(s.p3, s.p0));
  const handle = sub(s.c1, s.p0),
    end = unit(handle);
  near(chord.x * end.x + chord.y * end.y, Math.SQRT1_2);
  near(distance(s.p0, s.c1), 0.7 * distance(s.p0, s.p3));
  const loop = doubletGeometry([[1, 1]], `${neutral}\nbulge 90\nloopBend 90`);
  near(
    distance(loop.layoutCurves[0].path[0].p0, loop.layoutCurves[0].path[0].c1),
    1.25 * Math.E
  );
  assert.deepEqual(
    scale(loop.layoutCurves[0].direction, 1),
    loop.layoutCurves[0].direction
  );
});

it('renders nine parametric marker shapes at both boundary sizes and compensates painted tips', async () => {
  const { DOUBLET_MARKERS } = await import('../../src/links-view/doublet.js');
  for (const shape of DOUBLET_MARKERS) {
    for (const size of [0.5, 15]) {
      const f = doubletGeometry(
        [[0, 0]],
        `end\n  shape ${shape}\n  size ${size}`
      );
      const svg = createDoubletProvider().svg({ frame: f });
      if (shape === 'none') {
        assert.doesNotMatch(svg, /data-end="end"/u);
      } else {
        assert.match(
          svg,
          new RegExp(`data-marker="${shape}" data-end="end"`, 'u')
        );
      }
    }
  }
  for (const join of ['miter', 'round', 'bevel']) {
    for (const [end, shape] of [
      ['end', 'arrow'],
      ['end', 'triangle'],
      ['start', 'tail'],
    ]) {
      const f = doubletGeometry(
        [
          [2, 0],
          [0, 0],
        ],
        `gaps 0 0 0 0\narrowJoin ${join}\n${end}\n  shape ${shape}\n  angle 5`
      );
      const p = f.curves[0].markers.find((p) => p.end === end),
        sign = end === 'end' ? 1 : -1;
      assert.equal(p.compensated, true);
      near(p.point.x + sign * p.direction.x * p.extension, p.anchor.x, 0.01);
      near(p.point.y + sign * p.direction.y * p.extension, p.anchor.y, 0.01);
      for (const explicit of ['offset 0', 'across 0', 'rotation 0']) {
        const moved = doubletGeometry(
          [[0, 0]],
          `${end}\n  shape ${shape}\n  ${explicit}`
        );
        assert.equal(
          moved.curves[0].markers.find((p) => p.end === end).compensated,
          false
        );
      }
    }
  }
});

it('places offsets along arc, extends tangents, and applies across and rotation selectively', async () => {
  const { curveAtDistance } =
    await import('../../src/links-view/doublet-curves.js');
  const f = doubletGeometry(
    [[0, 0]],
    'gaps 0 0 0 0\nframe 10 50 50\nend\n  offset -20\n  across 3\n  rotation 30\nmiddle\n  shape circle\n  rotation 90'
  );
  const [s, t] = f.curves[0].path,
    p = f.curves[0].markers.find((p) => p.end === 'end');
  near(p.point.x, t.p3.x + 20);
  near(p.point.y, t.p3.y + 3);
  near(p.angle, 30);
  near(f.curves[0].markers.find((p) => p.end === 'middle').angle, 0);
  const before = curveAtDistance([s, t], -5);
  near(before.point.x, s.p0.x - 5);
  near(before.point.y, s.p0.y);
});

it('fits with marker-aware margins and a maximum scale of 60', async () => {
  const { markerExtent } =
    await import('../../src/links-view/doublet-markers.js');
  const small = doubletGeometry([[0, 0]], 'free 0.01');
  assert.equal(small.transform[0], 60);
  const f = doubletGeometry(
    [[0, 0]],
    'padding 1\nend\n  size 15\n  offset 20\n  across 20'
  );
  const o = f.options;
  near(
    f.margin,
    Math.min(
      48,
      Math.max(
        1,
        ...['start', 'end', 'middle'].map(
          (k) => markerExtent(o[k], o) + o.strokeWidth / 2
        )
      )
    )
  );
  assert.ok(f.transform[0] <= 60);
});

it('exports all caption, background, border and line variants with safe text', () => {
  const provider = createDoubletProvider();
  for (const n of [1, 9, 12]) {
    const items = Array.from({ length: n }, (_, i) => [i + 1, i + 1]);
    for (const mode of [
      'none',
      'theory',
      'pairs',
      'number',
      'links',
      'custom',
    ]) {
      const frame = doubletGeometry(
        items,
        `caption\n  mode ${mode}\n  text '<script>&"'\n  size 14\nwidth 64\nheight 128`,
        '123456789012345678901234567890'
      );
      const svg = provider.svg({ frame });
      if (mode === 'none') {
        assert.doesNotMatch(svg, /data-part="caption"/u);
      } else {
        assert.match(svg, /data-part="caption"/u);
      }
      if (mode === 'custom') {
        assert.match(svg, /&lt;script&gt;&amp;&quot;/u);
      }
      assert.match(svg, /viewBox="0 0 100 200"/u);
    }
  }
  for (const type of ['transparent', 'solid', 'linear', 'radial']) {
    for (const border of ['none', 'solid', 'dashed', 'dotted', 'double']) {
      const frame = doubletGeometry(
        [[0, 0]],
        `background\n  type ${type}\ncard\n  border ${border}\n  opacity 0.8\n  radius 12\n  inset 3\nglow 12\ndash dashdot`
      );
      const svg = provider.svg({ frame });
      assert.match(svg, /data-part="card"/u);
      if (type !== 'transparent') {
        assert.match(svg, /data-part="background"/u);
      }
      assert.match(svg, /feGaussianBlur/u);
      assert.match(svg, /stroke-dasharray="4 2 0 2"/u);
    }
  }
});

it('reports controls that are inert for free, self and reference-only networks', async () => {
  const { doubletOptionAvailability } =
    await import('../../src/links-view/doublet.js');
  assert.equal(doubletOptionAvailability([[0, 0]]).loop, false);
  assert.equal(doubletOptionAvailability([[1, 1]]).free, false);
  assert.equal(
    doubletOptionAvailability([
      [2, 2],
      [1, 1],
    ]).free,
    false
  );
  assert.equal(
    doubletOptionAvailability([
      [2, 2],
      [1, 1],
    ]).angles,
    true
  );
  assert.equal(
    doubletOptionAvailability([[0, 0]], 'frame 2 0 0').padding,
    false
  );
  assert.equal(
    doubletOptionAvailability([[0, 0]], 'angles mirror').sourceAngle,
    false
  );
});

it('bends neutral overlapping references into a point-symmetric 45-degree lens', () => {
  const f = doubletGeometry(
    [
      [0, 2],
      [1, 0],
    ],
    neutral
  );
  const a = f.layoutCurves[0].path[1],
    b = f.layoutCurves[1].path[0];
  const middle = { x: (a.p0.x + a.p3.x) / 2, y: (a.p0.y + a.p3.y) / 2 };
  for (let i = 0; i <= 20; i++) {
    const p = cubicPoint(a, i / 20),
      q = cubicPoint(b, 1 - i / 20);
    near(p.x + q.x, 2 * middle.x);
    near(p.y + q.y, 2 * middle.y);
  }
  const tangent = cubicDerivative(a, 1),
    chord = { x: a.p3.x - a.p0.x, y: a.p3.y - a.p0.y };
  near(
    (tangent.x * chord.x + tangent.y * chord.y) /
      Math.hypot(tangent.x, tangent.y) /
      Math.hypot(chord.x, chord.y),
    Math.SQRT1_2
  );
});

it('keeps each mirror half on one side of its chord to form a lens', () => {
  const f = doubletGeometry(
    [
      [2, 2],
      [1, 1],
    ],
    'angles mirror'
  );
  for (const c of f.layoutCurves) {
    for (const s of c.path) {
      const cross = (p) =>
        (s.p3.x - s.p0.x) * (p.y - s.p0.y) - (s.p3.y - s.p0.y) * (p.x - s.p0.x);
      assert.ok(cross(s.c1) * cross(s.c2) > 0);
    }
  }
});
