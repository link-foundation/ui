import { URL } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultVocabulary } from '@link-foundation/ui-core';
import { loadMapping } from '../src/index.js';
import { fluentMappingTable } from '../scripts/fluent2-docs.mjs';
it('covers all requested React v9 components with real kinds and current documentation', async () => {
  const rows = loadMapping(
    await readFile(
      new URL('../themes/fluent2/fluent-mapping.lino', import.meta.url),
      'utf8'
    )
  );
  const expected = [
    'Button',
    'ToggleButton',
    'Input',
    'Textarea',
    'Checkbox',
    'RadioGroup',
    'Switch',
    'Slider',
    'Dropdown',
    'Combobox',
    'Dialog',
    'Menu',
    'Tooltip',
    'Toast',
    'Drawer',
    'TabList',
    'Card',
    'Avatar',
    'Badge',
    'Spinner',
  ];
  assert.deepEqual(
    rows.map((r) => r.component),
    expected
  );
  for (const row of rows) {
    const kind = defaultVocabulary().kinds.get(row.kind);
    assert.ok(kind, row.kind);
    for (const prop of row.props) {
      assert.ok(
        kind.properties.has(prop.target[0]),
        `${row.component}/${prop.target[0]}`
      );
    }
  }
  const doc = await readFile(
    new URL('../../../docs/themes/fluent2.md', import.meta.url),
    'utf8'
  );
  assert.equal(
    doc
      .split('<!-- mapping:start -->\n')[1]
      .split('<!-- mapping:end -->')[0]
      .trim(),
    (await fluentMappingTable()).trim()
  );
  assert.equal(rows[0].props.filter((p) => p.name === 'appearance').length, 5);
});
it('rejects malformed or duplicate migration rows', () => {
  assert.throws(
    () =>
      loadMapping(
        'map Button\n  kind button\n  status mapped\n  prop appearance primary invalid'
      ),
    TypeError
  );
  assert.throws(
    () => loadMapping('map Button\n  kind button\n  status invented'),
    TypeError
  );
  assert.throws(
    () =>
      loadMapping(
        'map Button\n  kind button\n  status mapped\nmap Button\n  kind button\n  status mapped'
      ),
    TypeError
  );
});
