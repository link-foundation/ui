// How ui-core and links-notation read the link-view example.
import { parse, parseLinks } from '@link-foundation/ui-core';
const text = `(simple: link-view
  (link (id 1) (source 1) (target 2))
  (markers (source bar) (target arrow))
  (blueprint true)
  (grid true))`;
const doc = parse(text);
console.log(JSON.stringify(doc.roots, null, 1));
console.log(doc.diagnostics);
const unchecked = parse(text, { checks: false });
console.log(
  'checks:false',
  JSON.stringify(unchecked.roots[0].unknown),
  unchecked.diagnostics
);
console.log(
  JSON.stringify(
    parse(
      'link-view\n  link\n    id 1\n    source 1\n    target 0\n  bend 0.5',
      { checks: false }
    ).roots
  )
);
console.log('parseLinks', JSON.stringify(parseLinks(text)));
console.log(
  'parseLinks indented',
  JSON.stringify(parseLinks('link-view\n  link\n    id 1\n  bend 0.5'))
);
console.log(
  'parseLinks quoted',
  JSON.stringify(parseLinks("(link-view (label 'a b'))"))
);
