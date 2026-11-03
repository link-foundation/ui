// Regenerates the ui-convert importer fixtures in the default nested form (#133).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importHtml, importJsx, importVue } from '@link-foundation/ui-convert';
const root = 'packages/ui-convert/tests';
const regen = (dir, pattern, run) => {
  for (const file of readdirSync(dir).filter((f) => pattern.test(f))) {
    const out = join(dir, `${file.slice(0, file.lastIndexOf('.'))}.lino`);
    writeFileSync(out, run(readFileSync(join(dir, file), 'utf8')));
    console.log('wrote', out);
  }
};
regen(join(root, 'html/fixtures'), /\.html$/, (t) => importHtml(t).text);
regen(join(root, 'jsx/fixtures'), /\.(jsx|tsx)$/, (t) => importJsx(t).text);
regen(join(root, 'vue/fixtures'), /\.vue$/, (t) => importVue(t).text);
