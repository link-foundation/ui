/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultVocabulary } from '@link-foundation/ui-core';
import { getKind } from '@link-foundation/ui-dom';
import { registerControls } from '../../ui-components/src/controls/index.js';
import '../../ui-components/src/layout/index.js';
import '../../ui-components/src/overlays/index.js';
import '../../ui-components/src/data/index.js';
import { getMuiMapping } from '../src/index.js';
import { mappingMarkdown } from '../scripts/mapping-to-md.mjs';

it('covers every requested MUI component with real registered kinds and explicit statuses', async () => {
  const kinds = new Map();
  registerControls(kinds);
  const rows = await getMuiMapping();
  const required =
    'Button IconButton TextField Checkbox Radio RadioGroup Switch Slider Select Dialog Menu Tooltip Snackbar Drawer AppBar Tabs Card Paper Container List Table Chip Accordion Avatar Badge Box Stack Grid Typography CircularProgress'.split(
      ' '
    );
  assert.equal(new Set(rows.map((r) => r.component)).size, rows.length);
  for (const component of required) {
    assert.ok(
      rows.some((r) => r.component === component),
      component
    );
  }
  for (const row of rows) {
    assert.ok(['mapped', 'partial', 'none'].includes(row.status));
    if (row.status !== 'none') {
      assert.ok(getKind(row.kind, kinds), `${row.component}: ${row.kind}`);
      for (const prop of row.props) {
        assert.ok(
          defaultVocabulary()
            .kinds.get(row.kind)
            ?.properties.has(prop.target.name),
          `${row.component}: ${row.kind}.${prop.target.name}`
        );
      }
    } else {
      assert.equal(row.kind, null);
    }
  }
});
it('keeps the generated mapping documentation current', async () => {
  assert.equal(
    await readFile(
      new URL('../../../docs/themes/material3.md', import.meta.url),
      'utf8'
    ),
    await mappingMarkdown()
  );
});
it('maps the surfaces, chip, accordion and the ring to their tested kinds', async () => {
  const rows = new Map((await getMuiMapping()).map((r) => [r.component, r]));
  const kinds = {
    Container: 'container',
    Paper: 'paper',
    Card: 'card',
    AppBar: 'app-bar',
    Chip: 'chip',
    Accordion: 'accordion',
    CircularProgress: 'progress',
  };
  for (const [component, kind] of Object.entries(kinds)) {
    assert.equal(rows.get(component).kind, kind);
    assert.equal(rows.get(component).status, 'partial');
  }
  assert.ok(
    rows
      .get('CircularProgress')
      .props.some(({ target }) => target.name === 'shape')
  );
});
