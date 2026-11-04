import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@link-foundation/ui-core';
import { listThemes } from '@link-foundation/ui-themes';
import { loadCatalog } from '../src/gallery/catalog.js';
import { validateDocument } from '../src/playground/validate.js';
import { buildMatrix } from '../src/gallery/matrix.js';

test('every example appears in every theme, scheme and supported state', async () => {
  for (const { examples } of await loadCatalog()) {
    for (const example of examples) {
      const matrix = buildMatrix(example, {
        themes: listThemes(),
        schemes: ['light', 'dark'],
        states: ['default', 'disabled'],
      });
      assert.equal(matrix.length, listThemes().length * 4);
      assert.equal(new Set(matrix.map((c) => c.key)).size, matrix.length);
      for (const cell of matrix) {
        assert.deepEqual(validateDocument(cell.links).errors, [], cell.key);
        const doc = parse(cell.links);
        assert.equal(
          doc.diagnostics.filter((d) => d.severity === 'error').length,
          0
        );
        assert.ok(cell.links.includes(`theme ${cell.theme}`));
        assert.ok(cell.links.includes(`scheme ${cell.scheme}`));
      }
    }
  }
});
