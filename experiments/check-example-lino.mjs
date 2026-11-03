import { URL } from 'node:url';
import { parseDiagram } from '../packages/ui-components/src/index.js';
import { readFileSync } from 'node:fs';
const html = readFileSync(
  new URL('../packages/ui-components/examples/diagrams.html', import.meta.url),
  'utf8'
);
for (const m of html.matchAll(/<ui-diagram[^>]*>([\s\S]*?)<\/ui-diagram>/g)) {
  try {
    const d = parseDiagram(m[1].trim());
    console.log(
      'ok',
      d.id,
      d.kind,
      d.nodes.map((n) => n.label ?? n.id)
    );
  } catch (e) {
    console.log('ERR', e.message);
  }
}
