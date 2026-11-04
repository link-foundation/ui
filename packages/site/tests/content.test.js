import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPages } from '../pages.js';
import { listThemes } from '@link-foundation/ui-themes';

export const pageOptions = {
  contentDir: fileURLToPath(new globalThis.URL('../content', import.meta.url)),
  layout: fileURLToPath(new globalThis.URL('../layout.lino', import.meta.url)),
  languages: ['en', 'ru'],
};

test('all twelve LiNo pages parse, localize and share the same page set', async () => {
  const pages = await loadPages(pageOptions);
  assert.equal(pages.length, 12);
  for (const language of pageOptions.languages) {
    assert.deepEqual(
      pages.filter((p) => p.language === language).map((p) => p.page),
      ['about', 'components', 'dialect', 'getting-started', 'index', 'themes']
    );
  }
  for (const page of pages) {
    assert.deepEqual(page.document.diagnostics, [], page.file);
    assert.ok(!page.text.includes('t nav.'), page.file);
    assert.deepEqual(
      page.document.byId
        .get('theme-choice')
        .children.map((option) => option.id),
      listThemes()
    );
  }
});
