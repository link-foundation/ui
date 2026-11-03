import assert from 'node:assert/strict';
import { test } from 'node:test';

test('exports an escaped React wrapper with one stub per action', async () => {
  const source =
    "app: document\n  t: text '` ${value}'\n  b: button\n    label OK\n    on press\n      navigate home\n";
  const result = await exportDocument(source, { target: 'react' });
  assert.equal(result.files[0].path, 'App.jsx');
  assert.match(result.files[0].contents, /\\` \\\$\{value\}/);
  assert.match(result.files[0].contents, /navigate/);
  assert.deepEqual(result.diagnostics, []);
});

import { parse } from '@link-foundation/ui-core';
import {
  exportDocument,
  collectActions,
  importJsx,
  componentVocabulary,
} from '../../src/index.js';
import { fixture, fixtures } from './helpers.js';

for (const target of ['react', 'vue', 'swiftui', 'compose']) {
  for (const mode of target === 'react' || target === 'vue'
    ? ['wrapper', 'eject']
    : ['wrapper']) {
    for (const name of fixtures) {
      test(`${name} ${target}/${mode}: golden output and determinism`, async () => {
        const result = await exportDocument(fixture(name), { target, mode });
        assert.deepEqual(
          await exportDocument(fixture(name), { target, mode }),
          result
        );
        for (const file of result.files) {
          const suffix = `${target}.${mode}.${file.path.split('.').pop()}`;
          assert.equal(file.contents, fixture(name, suffix));
        }
      });
    }
  }
}

test('accepts a core tree and collects distinct action calls in order', async () => {
  const tree = parse(
    'b: button\n  on press\n    navigate home\n    emit saved\n  on press\n    navigate home\n'
  );
  assert.deepEqual(collectActions(tree), [
    { name: 'navigate', args: ['home'] },
    { name: 'emit', args: ['saved'] },
  ]);
  const before = JSON.stringify(tree.roots);
  assert.deepEqual(
    await exportDocument(tree, { target: 'react' }),
    await exportDocument(
      (await import('@link-foundation/ui-core')).format(tree),
      { target: 'react' }
    )
  );
  assert.equal(JSON.stringify(tree.roots), before);
});

test('React eject form imports as exactly the original core tree', async () => {
  const original = parse(fixture('form'), {
    vocabulary: componentVocabulary(),
  });
  const result = await exportDocument(fixture('form'), {
    target: 'react',
    mode: 'eject',
  });
  const imported = importJsx(result.files[0].contents, { mappings: [] });
  assert.deepEqual(imported.diagnostics, []);
  assert.deepEqual(imported.tree.roots, original.roots);
});

test('rejects invalid target, mode and unsafe component names', async () => {
  for (const options of [
    { target: 'other' },
    { target: 'react', mode: 'other' },
    { target: 'vue', componentName: '../Bad' },
    { target: 'swiftui', componentName: 'View' },
    { target: 'swiftui', componentName: 'Group' },
  ]) {
    await assert.rejects(exportDocument('', options), TypeError);
  }
});

test('unsupported kinds and props always produce comments and structured warnings', async () => {
  for (const target of ['react', 'vue', 'swiftui', 'compose']) {
    const result = await exportDocument(fixture('unsupported'), {
      target,
      mode: 'eject',
    });
    for (const id of ['mystery', 'ok']) {
      assert.ok(
        result.diagnostics.some(
          (d) => d.code === 'unsupported' && d.id === id && d.target === target
        )
      );
    }
    assert.match(result.files[0].contents, /Unsupported/);
    assert.match(result.files[0].contents, /Still here/);
  }
});

test('top-level extension links produce a comment and unsupported diagnostic', async () => {
  const tree = parse('t: text Hello\n');
  tree.unknown.push(['extension', 'custom']);
  for (const target of ['react', 'vue', 'swiftui', 'compose']) {
    const result = await exportDocument(tree, { target });
    assert.ok(
      result.diagnostics.some(
        (d) => d.code === 'unsupported' && d.id === null && d.target === target
      )
    );
    assert.match(result.files[0].contents, /Unsupported link extension custom/);
  }
});

test('a tag override cannot hide an unsupported kind', async () => {
  for (const target of ['react', 'vue']) {
    const result = await exportDocument('custom: spaceship\n  tag article\n', {
      target,
      mode: 'eject',
    });
    assert.ok(
      result.diagnostics.some(
        (d) =>
          d.code === 'unsupported' && d.id === 'custom' && d.target === target
      )
    );
    assert.match(result.files[0].contents, /Unsupported kind spaceship/);
  }
});
