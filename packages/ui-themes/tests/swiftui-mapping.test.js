/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSwiftuiMapping, readMapping } from '../src/index.js';
import { generatedHigDoc } from '../scripts/mapping-to-md.mjs';
import { controlsVocabulary } from '../../ui-components/src/controls/index.js';
import { dataVocabulary } from '../../ui-components/src/data/vocabulary.js';
import { layoutVocabulary } from '../../ui-components/src/layout/index.js';
import { overlayVocabulary } from '../../ui-components/src/overlays/index.js';

it('every required SwiftUI view has a shared-format row and real mapped kinds', async () => {
  const rows = await getSwiftuiMapping();
  const names =
    'Button Toggle TextField SecureField Slider Stepper Picker List Form Section VStack HStack ZStack ScrollView TabView NavigationStack Sheet Alert Menu ProgressView Label Image'.split(
      ' '
    );
  assert.deepEqual(rows.map((row) => row.name).sort(), names.sort());
  const kinds = new Set([
    ...controlsVocabulary().kinds.keys(),
    ...dataVocabulary().kinds.keys(),
    ...layoutVocabulary().kinds.keys(),
    ...overlayVocabulary().kinds.keys(),
  ]);
  for (const row of rows) {
    if (row.status !== 'none') {
      assert.ok(kinds.has(row.kind), row.kind);
    }
  }
  assert.equal(
    rows.find((row) => row.name === 'NavigationStack').status,
    'none'
  );
  assert.deepEqual(rows.find((row) => row.name === 'Button').props[2].target, [
    'variant',
    'prominent',
  ]);
});

it('generated HIG mapping documentation is up to date', async () => {
  const actual = await readFile(
    new URL('../../../docs/themes/hig.md', import.meta.url),
    'utf8'
  );
  assert.equal(await generatedHigDoc(), actual);
});

it('shared loader refuses malformed mapping rows', () => {
  assert.throws(
    () =>
      readMapping(
        'map Bad (kind button) (status mapped) (prop variant bordered)'
      ),
    TypeError
  );
  assert.throws(
    () =>
      readMapping(
        'map Bad (kind button) (status mapped)\nmap Bad (kind switch) (status mapped)'
      ),
    TypeError
  );
  assert.throws(
    () => readMapping('map Missing\n  kind button\n  status unknown\n'),
    TypeError
  );
});
