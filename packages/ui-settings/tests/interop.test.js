import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createConfig } from '@link-foundation/ui-config';
import { parse } from '@link-foundation/ui-core';
import {
  readSchema,
  merge,
  fromLino,
  toLino,
  applyToRoot,
  beforePaintScript,
  paintSnapshot,
  createSettingsCodec,
  bindConfig,
} from '../src/index.js';

const text = `s: schema
  version 1
n:
  type number
  default 1
  min 0
  max 10
  step 1
  apply
    css-var --n
b:
  type toggle
  default false
  comfort`;

test('strict primitives and continuous clamp policy also round-trip LiNo', () => {
  const { schema } = readSchema(text, {
    normalization: { primitives: 'strict', numbers: 'clamp' },
  });
  assert.deepEqual(merge(schema, undefined, { n: '2.4', b: 'true' }).rejected, [
    'n',
    'b',
  ]);
  assert.equal(merge(schema, undefined, { n: 2.4 }).values.n, 2.4);
  assert.equal(merge(schema, undefined, { n: 22 }).values.n, 10);
  assert.equal(
    fromLino(schema, toLino(schema, { n: 2.4, b: true })).values.n,
    2.4
  );
});

test('compatibility codec validates decoded values and preserves viewer comfort', () => {
  const { schema } = readSchema(text);
  const codec = createSettingsCodec(schema, {
    decode: JSON.parse,
    encode: JSON.stringify,
  });
  assert.equal(codec.read('{"n":3}').values.n, 3);
  assert.equal(
    codec.read('{"n":3,"b":false}', { base: { b: true }, look: true }).values.b,
    true
  );
  assert.equal(codec.read('invalid').ok, false);
  assert.deepEqual(JSON.parse(codec.write({ n: 3 })), { n: 3 });
});

test('runtime projection removes inherited variables and avoids redundant writes', () => {
  const { schema } = readSchema(text);
  const root = new JSDOM('<html></html>').window.document.documentElement;
  root.style.setProperty('--corner', '8px');
  const project = (values) => ({
    css: {
      '--corner': null,
      '--rgb': `${values.n}, 0, 0`,
      '--resolved': `${values.n * 2}px`,
    },
  });
  applyToRoot(schema, { n: 3 }, root, { project });
  assert.equal(root.style.getPropertyValue('--corner'), '');
  assert.equal(root.style.getPropertyValue('--rgb'), '3, 0, 0');
  let writes = 0;
  const set = root.style.setProperty.bind(root.style);
  root.style.setProperty = (...args) => {
    writes++;
    set(...args);
  };
  applyToRoot(schema, { n: 3 }, root, { project });
  assert.equal(writes, 0);
});

test('before paint reads a compatibility storage key and applies the same projection', () => {
  const { schema } = readSchema(text, { normalization: { numbers: 'clamp' } });
  const dom = new JSDOM('<html></html>', {
    url: 'https://example.test',
    runScripts: 'outside-only',
  });
  dom.window.localStorage.setItem('settings:', '{"n":2.4}');
  const script = beforePaintScript(schema, {
    storageKey: 'settings:',
    readStorage: (raw) => JSON.parse(raw),
    project: (values) => ({ css: { '--resolved': `${values.n * 2}px` } }),
  });
  dom.window.eval(script);
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--n'),
    '2.4'
  );
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--resolved'),
    '4.8px'
  );
});

test('strict nullable values reject a string sentinel but LiNo null round-trips', () => {
  const { schema } = readSchema(
    `s: schema
  version 1
corner:
  type number
  default null
  nullable true
  apply
    css-var --corner`,
    { normalization: { primitives: 'strict' } }
  );
  assert.equal(merge(schema, undefined, { corner: null }).values.corner, null);
  assert.deepEqual(merge(schema, undefined, { corner: 'null' }).rejected, [
    'corner',
  ]);
  assert.equal(
    fromLino(schema, toLino(schema, { corner: null })).values.corner,
    null
  );
  const dom = new JSDOM('<html style="--corner:8px"></html>', {
    runScripts: 'outside-only',
  });
  dom.window.eval(beforePaintScript(schema));
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--corner'),
    ''
  );
  dom.window.close();
});

test('serialized hooks cannot terminate the enclosing script regardless of case', () => {
  const { schema } = readSchema(text);
  const script = beforePaintScript(schema, {
    project: () => ({ attributes: { 'data-example': '</ScRiPt>' } }),
  });
  assert.equal(/<\/script/i.test(script), false);
  const dom = new JSDOM('<html></html>', { runScripts: 'outside-only' });
  dom.window.eval(script);
  assert.equal(
    dom.window.document.documentElement.getAttribute('data-example'),
    '</ScRiPt>'
  );
  dom.window.close();
});

test('projection snapshots retain unapplied dependencies and remove explicit stored null', () => {
  const { schema } = readSchema(`s: schema
  version 1
corner:
  type number
  default 4
  nullable true
  apply
    css-var --corner
noise:
  type number
  default 0`);
  const dom = new JSDOM('<html style="--corner:8px"></html>', {
    url: 'https://example.test',
    runScripts: 'outside-only',
  });
  dom.window.localStorage.setItem(
    'link-ui.settings.paint.v1',
    paintSnapshot(schema, { corner: null, noise: 0.6 }, { includeAll: true })
  );
  dom.window.eval(
    beforePaintScript(schema, {
      project: (values) => ({ css: { '--noise': values.noise } }),
    })
  );
  const style = dom.window.document.documentElement.style;
  assert.equal(style.getPropertyValue('--corner'), '');
  assert.equal(style.getPropertyValue('--noise'), '0.6');
  dom.window.close();
});

test('strict runtime values survive LiNo config binding and nullable overrides', () => {
  const { schema } = readSchema(
    `s: schema
  version 1
n:
  type number
  default 4
  step 1
  nullable true`,
    { normalization: { primitives: 'strict', numbers: 'clamp' } }
  );
  const config = createConfig({
    document: parse(`app: document
  settings: group`),
  });
  const bound = bindConfig(config, schema);
  assert.deepEqual(bound.update({ n: '2.4' }).rejected, ['n']);
  bound.update({ n: 2.4 });
  assert.equal(bound.get('n'), 2.4);
  bound.update({ n: null });
  assert.equal(bound.get('n'), null);
  bound.reset();
  assert.equal(bound.get('n'), 4);
});
