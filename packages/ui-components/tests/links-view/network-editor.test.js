import { it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNetworkPresentation } from '../../src/links-view/presentation.js';
import { createNetworkEditor } from '../../src/links-view/network-editor/editor.js';
import {
  normalize,
  toOptions,
} from '../../src/links-view/network-editor/options.js';
import { decode, indexOf } from '../../src/links-view/configurations.js';

async function setup(code = '11 22 12', initial = {}, extras = {}) {
  const { window } = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'https://example.test/',
  });
  const dom = {
    window,
    document: window.document,
    container: window.document.getElementById('app'),
  };
  dom.window.history.replaceState = () => {};
  const presentation = createNetworkPresentation({
    geometry: ({ input }) => ({
      positions: new Map(input.items.map((v, i) => [v.id, { x: i, y: i }])),
      pins: new Map(),
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    }),
    svg: ({ input }) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><title>${input.index}</title></svg>`,
  });
  await presentation.update({
    items: decode(code).map(([source, target], i) => ({
      id: String(i + 1),
      source,
      target,
    })),
    index: String(indexOf(decode(code))),
    options: toOptions(normalize(initial)),
  });
  const editor = createNetworkEditor(dom.container, {
    presentation,
    syncUrl: false,
    ...extras,
  });
  const input = (label) =>
    [...dom.document.querySelectorAll('label')]
      .find((el) => el.firstElementChild.textContent === label)
      ?.querySelector('input,select');
  const button = (label) =>
    [...dom.document.querySelectorAll('button')].find(
      (el) => el.textContent === label
    );
  const type = async (label, text) => {
    const el = input(label);
    el.value = text;
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await editor.ready;
  };
  return {
    ...dom,
    editor,
    presentation,
    input,
    button,
    type,
    close() {
      editor.dispose();
      presentation.dispose();
      dom.window.close();
    },
  };
}

it('updates all notations live, preserves typed text and localizes errors without changing the drawing', async () => {
  const s = await setup('11', {}, { locale: 'ru' });
  await s.type('number', '0120₃');
  assert.equal(s.input('number').value, '0120₃');
  assert.equal(s.input('pairs').value, '01 20');
  assert.equal(s.input('theory').value, 'λ = {1 ↦ (0, 1), 2 ↦ (2, 0)}');
  assert.equal(s.input('links').value, '(1: 0 1) (2: 2 0)');
  const before = s.presentation.toSvg();
  await s.type('number', '0120₄');
  assert.equal(s.presentation.toSvg(), before);
  assert.equal(s.input('number').getAttribute('aria-invalid'), 'true');
  assert.match(
    s.document.getElementById('app-number-error').textContent,
    /Основание/u
  );
  await s.editor.updateOptions({ color: '#abcdef' });
  assert.equal(s.input('number').value, '0120₄');
  await s.presentation.update({
    items: [{ id: '1', source: 1, target: 1 }],
    index: '3',
  });
  assert.equal(s.input('number').value, '11₂');
  s.close();
});
it('removes and renames a link together with its turns, gaps and colour', async () => {
  const s = await setup('01 20 32', {
    turns: [
      [1, 2],
      [3, 4],
      [30, -30],
    ],
    linkGaps: [
      [null, null, null, null],
      [0.1, 0.2, 1, 2],
      [0.3, null, 5, null],
    ],
    linkColors: ['#000000', '#111111', '#abcdef'],
  });
  s.button('Remove link 2').click();
  await s.editor.ready;
  const state = s.editor.snapshot();
  assert.equal(state.code, '01 20');
  assert.deepEqual(state.options.turns, [
    [1, 2],
    [30, -30],
  ]);
  assert.equal(state.options.linkColors[1], '#abcdef');
  assert.deepEqual(state.options.linkGaps[1], [0.3, null, 5, null]);
  s.button('Next').click();
  await s.editor.ready;
  s.close();
});
it('counts across sizes, hides inert controls, and clears geometry pins while keeping colour pins', async () => {
  const s = await setup('22 22', { frame: [2, 10, -5], order: [2, 1] });
  await s.editor.updateOptions({ color: '#abcdef' });
  assert.deepEqual(s.editor.snapshot().options.frame, [2, 10, -5]);
  await s.editor.updateOptions({ tension: 0.5 });
  assert.equal(s.editor.snapshot().options.frame, null);
  s.button('Next').click();
  await s.editor.ready;
  assert.equal(s.editor.snapshot().code, '00 00 00');
  assert.equal(s.editor.snapshot().options.order, null);
  await s.editor.updateLinks(decode('02 10'));
  assert.equal(s.input('loop').parentNode.hidden, true);
  await s.editor.updateLinks(decode('11'));
  assert.equal(s.input('loop').parentNode.hidden, false);
  assert.equal(s.button('Remove link 1').disabled, true);
  s.close();
});
it('looks retain per-link overrides, gaps, notation and solver settings, and sections reset', async () => {
  const s = await setup('01 20', {
    turns: [[3, 4]],
    linkGaps: [[null, 0.2, 5, null]],
    solveRange: 30,
    startGap: 0.3,
    tension: 0.7,
  });
  const look = s.input('Look');
  look.value = 'neon';
  look.dispatchEvent(new s.window.Event('change'));
  await s.editor.ready;
  const state = s.editor.snapshot();
  assert.equal(state.code, '01 20');
  assert.deepEqual(state.options.turns, [[3, 4]]);
  assert.equal(state.options.solveRange, 30);
  assert.equal(state.options.startGap, 0.3);
  assert.equal(s.button('Reset line').disabled, false);
  s.button('Reset line').click();
  await s.editor.ready;
  assert.equal(
    s.button('Reset line').disabled,
    true,
    JSON.stringify(s.editor.snapshot().options)
  );
  s.close();
});
it('solver UI applies only turns, gaps and frame and disables exports while running', async () => {
  let finish;
  const s = await setup(
    '22 11',
    { color: '#abcdef', solveRange: 30 },
    {
      solve: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }
  );
  s.button('Apply').click();
  assert.equal(s.button('Download PNG').disabled, true);
  finish({
    turns: [
      [45, -45],
      [0, 0],
    ],
    linkGaps: [[null, 0.2, null, null]],
    frame: [2, 10, -5],
    before: 5,
    after: 1,
    color: '#ff0000',
  });
  await s.editor.ready;
  const state = s.editor.snapshot();
  assert.equal(state.options.color, '#abcdef');
  assert.equal(state.options.solveRange, 30);
  assert.deepEqual(state.options.frame, [2, 10, -5]);
  assert.match(s.document.querySelector('[role=status]').textContent, /5 → 1/u);
  assert.equal(s.button('Download PNG').disabled, false);
  s.close();
});
it('stale solver results cannot overwrite editing and errors restore usable controls', async () => {
  let finish, signal;
  const s = await setup(
    '22 11',
    {},
    {
      solve: (_links, _options, context) => {
        signal = context.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }
  );
  s.button('Apply').click();
  const solving = s.editor.ready;
  await s.editor.updateOptions({ color: '#abcdef' });
  assert.equal(signal.aborted, true);
  finish({ turns: [[180, 180]], before: 10, after: 0 });
  await solving;
  assert.deepEqual(s.editor.snapshot().options.turns, []);
  s.close();
  const failed = await setup(
    '11',
    {},
    { solve: () => Promise.reject(new Error('solver failed')) }
  );
  failed.button('Apply').click();
  await failed.editor.ready;
  assert.match(
    failed.document.querySelector('[role=alert]').textContent,
    /solver failed/u
  );
  assert.equal(failed.button('Download SVG').disabled, false);
  failed.close();
});
it('uses numeric references above 50 links and disables canonical renaming above 7', async () => {
  const s = await setup(Array(51).fill('0,0').join(';'));
  assert.equal(s.input('source 1').type, 'number');
  assert.equal(s.input('source 1').max, '51');
  assert.equal(s.button('Canonical renaming').disabled, true);
  s.close();
});
it('saved LiNo styles load and retain current gaps, turns and solver settings', async () => {
  const s = await setup('11', { color: '#abcdef', tension: 0.7 });
  s.input('Style name').value = 'My style';
  s.button('Save style').click();
  await s.editor.ready;
  const text = s.window.localStorage.getItem('links-network-editor-styles');
  assert.ok(text.includes('My style'));
  await s.editor.updateOptions({
    color: '#112233',
    turns: [[10, 20]],
    startGap: 0.3,
    passes: 5,
  });
  s.button('Load style').click();
  await s.editor.ready;
  const result = s.editor.snapshot().options;
  assert.equal(result.color, '#abcdef');
  assert.equal(result.tension, 0.7);
  assert.deepEqual(result.turns, [[10, 20]]);
  assert.equal(result.startGap, 0.3);
  assert.equal(result.passes, 5);
  assert.equal(s.editor.snapshot().code, '11');
  s.close();
});
