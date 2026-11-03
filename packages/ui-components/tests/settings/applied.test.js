import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSettingsPanel } from '../../src/settings/index.js';
import { schema } from '../../examples/settings-schema.js';

const alternatives = {
  'liquid.blur': 24,
  'theme.mode': 'dark',
  'motion.reduce': true,
  accent: '#224488',
  title: 'Changed',
  scale: 2,
  offset: [2, 3],
  tags: ['other'],
};
for (const field of schema.fields.values()) {
  test(`example applies ${field.key} to the preview`, () => {
    const dom = new JSDOM('<!doctype html><div id="preview"></div>');
    const root = dom.window.document.querySelector('#preview');
    const panel = createSettingsPanel(schema, {
      document: dom.window.document,
      previewRoot: root,
    });
    try {
      assert.ok(Object.hasOwn(alternatives, field.key));
      const before = root.outerHTML;
      panel.update({ [field.key]: alternatives[field.key] });
      assert.notEqual(root.outerHTML, before);
      for (const hint of field.apply) {
        if (hint.cssVar) {
          assert.notEqual(root.style.getPropertyValue(hint.cssVar), '');
        }
        if (hint.dataAttr) {
          assert.ok(root.hasAttribute(`data-${hint.dataAttr}`));
        }
      }
    } finally {
      panel.destroy();
      dom.window.close();
    }
  });
}
