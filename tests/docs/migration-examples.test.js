import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { Parser } from 'links-notation';
import { parse, walk } from '@link-foundation/ui-core';
import {
  controlsVocabulary,
  layoutVocabulary,
  overlayVocabulary,
  registerControls,
} from '@link-foundation/ui-components';
import { getKind } from '@link-foundation/ui-dom';
import { readStyles } from '@link-foundation/ui-style';
import { loadThemes } from '@link-foundation/ui-tokens/themes';

const directory = fileURLToPath(
  new URL('../../docs/migration/examples/', import.meta.url)
);
const examples = readdirSync(directory).filter((name) =>
  name.endsWith('.lino')
);
const kinds = new Map([
  ...overlayVocabulary().kinds,
  ...controlsVocabulary().kinds,
  ...layoutVocabulary().kinds,
]);
const vocabulary = { ...controlsVocabulary(), kinds };
const renderers = new Map();
registerControls(renderers);

test('includes all three paired MUI migration examples', () => {
  for (const stem of ['mui-button-row', 'mui-form', 'mui-dialog']) {
    assert.ok(examples.includes(`${stem}.lino`), stem);
  }
  for (const file of examples) {
    assert.ok(readFileSync(`${directory}${file.slice(0, -5)}.jsx`, 'utf8'));
  }
});

for (const file of examples) {
  test(`${file} parses and uses exported component kinds and valid properties`, () => {
    const source = readFileSync(`${directory}${file}`, 'utf8');
    assert.ok(new Parser().parse(source).length > 0);
    const document = parse(source, { vocabulary });
    assert.deepEqual(document.diagnostics, [], file);
    assert.ok(document.roots.length > 0);
    walk(document, (node) => {
      assert.ok(kinds.has(node.kind), `${file}: exported kind ${node.kind}`);
      assert.ok(
        getKind(node.kind, renderers),
        `${file}: registered renderer ${node.kind}`
      );
      assert.deepEqual(node.unknown, [], `${file}: ${node.id}`);
    });
  });
}

test('example validation rejects an invented component and property', () => {
  for (const source of [
    'save: invented-mui-button\n  label Save\n',
    'save: button\n  fullWidth true\n',
  ]) {
    assert.ok(parse(source, { vocabulary }).diagnostics.length > 0);
  }
});

// Match Markdown fences only; LiNo itself is always parsed by the official reader.
test('mapping snippets are valid style rules, an action and a theme', () => {
  const mapping = readFileSync(`${directory}../mui-mapping.md`, 'utf8');
  const blocks = [...mapping.matchAll(/```lino\n([\s\S]*?)```/gu)].map(
    (match) => match[1]
  );
  assert.equal(blocks.length, 3);
  for (const block of blocks) {
    assert.ok(new Parser().parse(block).length > 0);
  }
  const styles = readStyles(blocks[0]);
  assert.deepEqual(styles.diagnostics, []);
  assert.equal(styles.rules.length, 4);
  assert.deepEqual(parse(blocks[1], { vocabulary }).diagnostics, []);
  const theme = loadThemes(blocks[2]);
  assert.deepEqual(theme.diagnostics, []);
  assert.equal(theme.themes[0].id, 'app-theme');
});
