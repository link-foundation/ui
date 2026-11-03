// Regenerate packages/ui-convert/tests/html/fixtures/*.lino from the .html files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';
import { importHtml } from '@link-foundation/ui-convert';
const dir = new URL(
  '../packages/ui-convert/tests/html/fixtures/',
  import.meta.url
);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(new URL(f, dir), 'utf8');
  writeFileSync(
    new URL(f.replace(/\.html$/, '.lino'), dir),
    importHtml(html).text
  );
}
