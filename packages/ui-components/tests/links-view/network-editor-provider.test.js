import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkEditorModel } from '../../src/links-view/network-editor/model.js';
import { createNetworkPresentation } from '../../src/links-view/presentation.js';
import {
  createNetworkEditorProvider,
  rendererOptions,
} from '../../src/links-view/network-editor/provider.js';
import {
  fromParams,
  toParams,
  normalize,
  toOptions,
} from '../../src/links-view/network-editor/options.js';
import {
  readDoubletOptions,
  doubletGeometry,
  doubletToSvg,
} from '../../src/links-view/doublet.js';

it('adapts renderer options and all per-link overrides without marking default markers explicit', async () => {
  assert.equal(rendererOptions({}, 2), '');
  assert.deepEqual(
    readDoubletOptions(rendererOptions({}, 2), 2).end.explicit,
    []
  );
  const options = normalize({
    'start.shape': 'diamond',
    'background.type': 'linear',
    'caption.text': 'Quoted "text"',
    tension: 0.8,
    startGap: 0.2,
    frame: [2, 10, -5],
    turns: [[30, -30]],
    linkGaps: [[0.1, null, 5, null]],
    linkColors: ['#abcdef'],
    palette: 'print',
    linejoin: 'bevel',
    order: [2, 1],
    passes: 5,
  });
  const parsed = readDoubletOptions(rendererOptions(options, 2), 2);
  assert.deepEqual(parsed.links[1].turns, [30, -30]);
  assert.deepEqual(parsed.links[1].gaps, [0.1, null, 5, null]);
  assert.equal(parsed.start.shape, 'diamond');
  assert.equal(parsed.background.type, 'linear');
  assert.equal(parsed.caption.text, 'Quoted "text"');
  assert.deepEqual(parsed.frame, [2, 10, -5]);
  assert.deepEqual(parsed.order, [2, 1]);
  assert.deepEqual(parsed.gaps, [0.2, 0.08, 0, 0]);
  const presentation = createNetworkPresentation(createNetworkEditorProvider());
  try {
    await presentation.update({
      items: [
        [2, 2],
        [1, 1],
      ],
      options: toOptions(options),
    });
    assert.match(presentation.toSvg(), /data-doublet="1" color="#abcdef"/u);
    assert.deepEqual(
      presentation.snapshot().frame,
      doubletGeometry(
        [
          [2, 2],
          [1, 1],
        ],
        rendererOptions(options, 2)
      )
    );
    assert.match(presentation.toSvg(), /stroke-linejoin="bevel"/u);
    assert.equal(presentation.snapshot().frame.options.tension, 0.8);
    assert.deepEqual(presentation.snapshot().frame.transform, [2, 10, -5]);
  } finally {
    presentation.dispose();
  }
});

it('reuses the prepared artwork for desktop and thumbnail SVGs', () => {
  const frame = doubletGeometry(
    [
      [0, 2],
      [2, 2],
    ],
    rendererOptions(
      {
        palette: 'inherit',
        linkColors: ['#abcdef'],
        width: 1200,
        height: 800,
        'background.type': 'linear',
        'card.border': 'double',
        'caption.mode': 'custom',
        'caption.text': 'Network & caption',
        'caption.position': 'top',
        title: 'A <diagram>',
      },
      2
    )
  );
  const desktop = doubletToSvg(frame);
  const thumbnail = doubletToSvg(frame, { width: 96, height: 64 });
  assert.equal(
    thumbnail,
    desktop.replace('width="1200" height="800"', 'width="96" height="64"')
  );
  assert.match(desktop, /aria-label="A &lt;diagram&gt;"/u);
  assert.match(desktop, /data-part="caption" x="75" y="[0-9.]+"/u);
  assert.equal(frame.curves[0].color, '#abcdef');
  assert.equal(frame.curves[1].color, 'currentColor');
});

it('force controls each affect the deterministic layout of a network with loops', () => {
  const pairs = [
    [1, 2],
    [1, 3],
    [4, 4],
    [0, 2],
  ];
  const base = doubletGeometry(pairs, 'layout force');
  for (const key of ['forceDistance', 'forceCharge', 'forceCollision']) {
    const options = `layout force\n${key} 2.5`;
    const result = doubletGeometry(pairs, options);
    assert.notDeepEqual(result.places, base.places, key);
    assert.deepEqual(
      result.places,
      doubletGeometry(pairs, options).places,
      key
    );
  }
  assert.equal(readDoubletOptions('(forceCharge: 1)', 2).forceCharge, 1);
  assert.equal(readDoubletOptions('(linejoin: bevel)', 2).linejoin, 'bevel');
});

it('renders legacy styles unchanged by canonical URL serialization', () => {
  const pairs = [
    [0, 2],
    [2, 2],
    [2, 1],
  ];
  const legacy = new globalThis.URLSearchParams({
    placement: 'circle',
    order: '3 1 2',
    width: '1080',
    height: '1920',
    end: 'triangle',
    arrowJoin: 'inherit',
    linejoin: 'bevel',
    lens: '0',
    turns: '30 -41,,5 -19',
    gaps: '0.15 ~ 3 1,,~ 0.32',
    colors: '#abcdef,#123456',
    frame: '18 50 75',
    card: '1',
    background: 'radial',
    bgColor: '#ffffff',
    bgColor2: '#cad4ed',
    caption: 'theory',
    notation: 'R',
    captionPosition: 'top',
  });
  const options = fromParams(legacy);
  const restored = fromParams(toParams(options));
  const frame = doubletGeometry(pairs, rendererOptions(options, 3));
  assert.deepEqual(doubletGeometry(pairs, rendererOptions(restored, 3)), frame);
  const desktop = doubletToSvg(frame);
  assert.match(desktop, /R = /u);
  assert.match(desktop, /data-marker="triangle".*stroke-linejoin="bevel"/u);
  assert.deepEqual(frame.transform, [18, 50, 75]);
  assert.deepEqual(
    frame.curves.map((curve) => curve.color),
    ['#abcdef', '#123456', '#f472b6']
  );
  assert.equal(
    doubletToSvg(frame, { width: 64, height: 64 }),
    desktop.replace('width="1080" height="1920"', 'width="64" height="64"')
  );
});

it('the public headless model prepares poses and styling on the host presentation', async () => {
  const presentation = createNetworkPresentation(createNetworkEditorProvider());
  await presentation.update({
    items: [
      [1, 1],
      [1, 2],
    ],
  });
  const changes = [];
  const model = createNetworkEditorModel(presentation, {
    onChange: (external) => changes.push(external),
  });
  try {
    await model.changeOptions({ palette: 'warm', linkColors: ['#aabbcc'] });
    assert.deepEqual(
      presentation.snapshot().frame.curves.map((curve) => curve.color),
      ['#aabbcc', '#ef4444']
    );
    assert.equal(model.snapshot().code, '11 12');
    await presentation.update({ items: [[0, 0]], options: '' });
    assert.equal(model.snapshot().code, '00');
    assert.equal(changes.at(-1), true);
  } finally {
    model.dispose();
    presentation.dispose();
  }
});
