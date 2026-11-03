// Render every story of the catalog in jsdom; print the document text and diagnostics.
/* global URL */
import { readFileSync } from 'node:fs';
import { createDom } from '../packages/ui-components/tests/support/dom.js';
import { mountControls } from '../packages/ui-components/src/controls/index.js';
import {
  parseCatalog,
  parseStories,
  storiesDocument,
} from '../packages/ui-components/src/controls/stories.js';
const root = new URL('../packages/ui-components/', import.meta.url);
const catalog = parseCatalog(
  readFileSync(new URL('src/controls/catalog.lino', root), 'utf8')
);
const sets = [...catalog.keys()].map((kind) =>
  parseStories(readFileSync(new URL(`stories/${kind}.lino`, root), 'utf8'))
);
const text = storiesDocument(sets);
if (process.argv[2] === 'text') {
  console.log(text);
}
const { container } = createDom();
const m = mountControls(container, text, {});
console.log(
  'diagnostics:',
  m.diagnostics.map((d) => `${d.code}@${d.at?.element}:${d.at?.property ?? ''}`)
);
console.log('nodes:', container.querySelectorAll('[data-link-id]').length);
