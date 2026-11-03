import { URL, fileURLToPath } from 'node:url';
import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { moduleGraph } from '../../ui-react/tests/module-graph.js';
it('native entry and its hooks graph import no DOM renderer or code evaluator', () => {
  const { files, unresolved } = moduleGraph(
    '@link-foundation/ui-react-native',
    fileURLToPath(import.meta.url)
  );
  assert.equal(files.length > 1, true);
  assert.deepEqual(
    [...files, ...unresolved].filter((name) =>
      /(?:^|[/\\])(?:react-dom|ui-dom)(?:[/\\]|$)/.test(name)
    ),
    []
  );
  for (const name of readdirSync(new URL('../src/', import.meta.url)).filter(
    (name) => name.endsWith('.js')
  )) {
    assert.doesNotMatch(
      readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'),
      /eval\(|new Function/
    );
  }
});

it('the memory store entry excludes optional persistence adapters', () => {
  const { files } = moduleGraph(
    '@link-foundation/ui-store/memory',
    fileURLToPath(import.meta.url)
  );
  assert.equal(
    files.some((file) => file.endsWith('/store.js')),
    true
  );
  assert.deepEqual(
    files.filter((file) =>
      /doublets-web|persistent\.js|web-adapter\.js/.test(file)
    ),
    []
  );
});
