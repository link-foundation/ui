import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  controlKindNames,
  CONTROL_KIND_SPECS,
} from '@link-foundation/ui-components/controls';
import { loadCatalog } from '../src/gallery/catalog.js';
import { validateDocument } from '../src/playground/validate.js';

test('every catalog component has valid reusable examples', async () => {
  const catalog = await loadCatalog();
  assert.deepEqual(
    catalog.map((c) => c.kind),
    controlKindNames()
  );
  for (const component of catalog) {
    assert.ok(component.examples.length, component.kind);
    for (const example of component.examples) {
      assert.equal(
        validateDocument(example.text).errors.length,
        0,
        example.file
      );
    }
  }
});
test('missing example directories produce an error', async () => {
  await assert.rejects(
    loadCatalog({
      examplesDir: new globalThis.URL('./missing/', import.meta.url),
    })
  );
});

test('every gallery example renders statically without unknown controls', async () => {
  const { renderToHTML } = await import('@link-foundation/ui-dom');
  for (const { examples } of await loadCatalog()) {
    for (const example of examples) {
      const diagnostics = [];
      const html = renderToHTML(validateDocument(example.text).tree, {
        kinds: CONTROL_KIND_SPECS,
        onDiagnostic: (d) => diagnostics.push(d),
      });
      assert.deepEqual(
        diagnostics.filter((d) => d.code === 'kind-error'),
        [],
        example.id
      );
      assert.ok(!html.includes('<ui-unknown'), example.id);
    }
  }
});
