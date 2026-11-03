/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultVocabulary } from '@link-foundation/ui-core';
import { registeredKinds } from '@link-foundation/ui-dom';
import { registerControls } from '../../ui-components/src/controls/index.js';
import '../../ui-components/src/layout/index.js';
import '../../ui-components/src/overlays/index.js';
import '../../ui-components/src/data/index.js';
import { getMuiMapping } from '../src/index.js';
import { mappingMarkdown } from '../scripts/mapping-to-md.mjs';

it('covers every requested MUI component with real registered kinds and explicit statuses', async () => {
  registerControls();
  const rows = await getMuiMapping();
  const required =
    'Button IconButton TextField Checkbox Radio RadioGroup Switch Slider Select Dialog Menu Tooltip Snackbar Drawer AppBar Tabs Card List Table Chip Avatar Badge Box Stack Grid Typography CircularProgress'.split(
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
      assert.ok(
        registeredKinds().includes(row.kind),
        `${row.component}: ${row.kind}`
      );
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
