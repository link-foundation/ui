import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkPresentation } from '../../src/links-view/presentation.js';

const input = {
  items: [{ id: '1', source: '1', target: '1' }],
  index: '900719925474099312345',
  options:
    'appearance\n  start\n    shape arrow\n    size 19\n  gaps 1 2 3 4\n',
};
const frame = {
  positions: new Map([['1', { x: 12, y: 15 }]]),
  pins: new Map(),
  bounds: { x: 0, y: 0, width: 100, height: 60 },
};

it('uses the same solved frame and lossless LiNo options for preview and exports', async () => {
  const requests = [];
  const presentation = createNetworkPresentation({
    geometry(request) {
      requests.push(request);
      return frame;
    },
    solve(request) {
      return { ...request.frame, pins: new Map([['1', { x: 12, y: 15 }]]) };
    },
    svg(request) {
      assert.equal(request.input.index, input.index);
      assert.match(request.input.options, /size 19/u);
      assert.equal(request.frame.pins.size, 1);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"></svg>';
    },
    raster(request) {
      return new globalThis.Blob([request.svg], { type: request.type });
    },
  });
  await presentation.update(input);
  await presentation.solve();
  const preview = presentation.toSvg();
  assert.equal(
    await (await presentation.toRaster('image/webp')).text(),
    preview
  );
  assert.equal(presentation.snapshot().frame.pins.size, 1);
  assert.equal(requests[0].input.index, input.index);
  input.items[0].target = '0';
  assert.equal(presentation.snapshot().input.items[0].target, '1');
  const copy = presentation.snapshot();
  copy.frame.pins.clear();
  assert.equal(presentation.snapshot().frame.pins.size, 1);
});

it('rejects malformed configuration and preserves settings across network traversal', async () => {
  const p = createNetworkPresentation({
    geometry: () => frame,
    svg: () => '<svg></svg>',
  });
  await p.update(input);
  await p.update({ items: [], index: '0' });
  assert.equal(p.snapshot().input.options, input.options);
  await assert.rejects(
    p.update({ index: 9007199254740992 }),
    /decimal string/u
  );
  await assert.rejects(p.update({ options: '(' }));
  assert.equal(p.snapshot().input.index, '0');
});

it('discards stale geometry and solver results without reverting newer input', async () => {
  const pending = [];
  const p = createNetworkPresentation({
    geometry: () => frame,
    solve: (request) =>
      new Promise((resolve) => pending.push({ request, resolve })),
    svg: () => '<svg></svg>',
  });
  await p.update(input);
  const committed = p.snapshot().revision;
  const solving = p.solve();
  assert.equal(p.snapshot().revision, committed);
  assert.ok(pending[0].request.revision > committed);
  await p.update({ index: '2' });
  assert.equal(pending[0].request.signal.aborted, true);
  pending[0].resolve({ ...frame, pins: new Map([['stale', { x: 1, y: 1 }]]) });
  assert.equal(await solving, false);
  assert.equal(p.snapshot().input.index, '2');
  assert.equal(p.snapshot().frame.pins.size, 0);
  p.dispose();
  await assert.rejects(p.update({ index: '3' }), /disposed/u);
});

it('mounts provider SVG in links-network and exports the identical preview after solving', async () => {
  const { createDom } = await import('../support/dom.js');
  const { defineLinksNetwork } =
    await import('../../src/links-view/links-network.js');
  const { window, document } = createDom();
  defineLinksNetwork(window, { animator: { reducedMotion: () => true } });
  const p = createNetworkPresentation({
    geometry: () => frame,
    solve: ({ frame }) => ({
      ...frame,
      pins: new Map([['1', { x: 12, y: 15 }]]),
    }),
    svg: ({ frame }) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><text>${frame.pins.size}</text></svg>`,
  });
  await p.update({ ...input, items: [{ id: '1', source: '1', target: '1' }] });
  const node = document.createElement('links-network');
  document.body.append(node);
  await node.ready;
  node.presentation = p;
  assert.equal(node.toSvg(), node.shadowRoot.querySelector('svg').outerHTML);
  const solving = node.layout();
  assert.equal(node.ready, solving);
  await node.ready;
  assert.equal(node.toSvg(), node.shadowRoot.querySelector('svg').outerHTML);
  assert.equal(node.pins.size, 1);
  node.remove();
  await p.update({ index: '45' });
  document.body.append(node);
  assert.equal(node.toSvg(), node.shadowRoot.querySelector('svg').outerHTML);
  p.dispose();
  window.close();
});

it('isolates backend mutations and retains committed state after a failed job', async () => {
  const p = createNetworkPresentation({
    geometry(request) {
      if (request.input.index === '2') {
        throw new Error('backend failure');
      }
      request.input.index = '99';
      return frame;
    },
    svg: () => '<svg></svg>',
  });
  await p.update({ index: '1' });
  const before = p.snapshot();
  await assert.rejects(p.update({ index: '2' }), /backend failure/u);
  assert.deepEqual(p.snapshot(), before);
  assert.match(p.toLino(), /index 1/u);
});

it('retains pending settings when navigating before geometry completes', async () => {
  const pending = [];
  const p = createNetworkPresentation({
    geometry: (request) =>
      new Promise((resolve) => pending.push({ request, resolve })),
    svg: () => '<svg></svg>',
  });
  const settings = p.update({ options: input.options });
  const navigation = p.update({ index: '25' });
  assert.equal(pending[1].request.input.options, input.options);
  pending[1].resolve(frame);
  assert.equal(await navigation, true);
  pending[0].resolve(frame);
  assert.equal(await settings, false);
  assert.equal(p.snapshot().input.options, input.options);
  assert.equal(p.snapshot().input.index, '25');
});

it('reports provider failures through network readiness and clears recovered diagnostics', async () => {
  const { createDom } = await import('../support/dom.js');
  const { defineLinksNetwork } =
    await import('../../src/links-view/links-network.js');
  const { window, document } = createDom();
  defineLinksNetwork(window, { animator: { reducedMotion: () => true } });
  const p = createNetworkPresentation({
    geometry({ input }) {
      if (input.items.some(({ id }) => id === 'fail')) {
        throw new Error('backend failure');
      }
      return frame;
    },
    svg: () => '<svg></svg>',
  });
  await p.update({ items: [] });
  const node = document.createElement('links-network');
  document.body.append(node);
  await node.ready;
  node.presentation = p;
  const errors = [];
  node.addEventListener('layouterror', ({ detail }) => errors.push(detail));
  node.items = [{ id: 'fail', source: 'fail', target: 'fail' }];
  await assert.rejects(node.ready, /backend failure/u);
  assert.equal(errors.length, 1);
  assert.equal(node.diagnostics[0].message, 'backend failure');
  assert.equal(p.snapshot().input.items.length, 0);
  node.items = [];
  await node.ready;
  assert.deepEqual(node.diagnostics, []);
  node.remove();
  p.dispose();
  window.close();
});
