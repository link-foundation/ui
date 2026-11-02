import { Parser } from 'links-notation';
import { importHtml } from '@link-foundation/ui-convert';
const { text, links } = importHtml('<button class="a">OK</button>');
console.log(text);
const parsed = new Parser().parse(text);
console.log(
  parsed.map((l) => l.format()),
  links.map((l) => l.format())
);
const groups = new Parser().parseGroups(text);
console.log(
  JSON.stringify(
    groups.map((g) => ({ e: g.element.format(), c: g.children.length }))
  )
);
