import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { walk } from '@link-foundation/ui-core';
import { loadPages, property } from '../pages.js';

const options = {
  contentDir: fileURLToPath(new globalThis.URL('../content', import.meta.url)),
  layout: fileURLToPath(new globalThis.URL('../layout.lino', import.meta.url)),
  languages: ['en', 'ru'],
};

test('every internal link resolves to a generated page under the Pages base', async () => {
  const pages = await loadPages(options);
  const routes = new Set(pages.map((p) => `/ui/${p.route}`));
  for (const page of pages) {
    walk(page.document, (node) => {
      if (node.kind !== 'link') {
        return;
      }
      const href = property(node, 'href');
      const target = new globalThis.URL(
        href,
        `https://site.test/ui/${page.route}`
      );
      if (target.origin === 'https://site.test') {
        assert.ok(
          routes.has(target.pathname),
          `${page.route}: ${href} -> ${target.pathname}`
        );
      }
    });
  }
});
