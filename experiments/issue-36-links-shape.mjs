// The shape of links-notation Link objects for the issue-36 dock sample,
// and how Link#format writes values that need quoting.
import { Parser, Link, formatLinks } from 'links-notation';
const links = new Parser().parse(`(designer-shell: dock
  (persist 'designer.layout')
  (left: region (size 16rem) (panels toolbox outline))
  (float toolbox (x 40) (y 60))
  (closed problems bottom))`);
const show = (l) =>
  l.values?.length ? { id: l.id, values: l.values.map(show) } : { id: l.id };
console.log(JSON.stringify(links.map(show), null, 1));
console.log(
  new Link('a b').format(),
  new Link("it's").format(),
  new Link('x:y').format(),
  new Link('a.b').format()
);
console.log(formatLinks(links));
console.log(
  new Link('left', [
    new Link('region'),
    new Link(null, [new Link('size'), new Link('16rem')]),
  ]).format()
);
