import { Link, Parser } from 'links-notation';
const l = new Link('vue-script', [
  new Link('vue-block'),
  new Link(null, [
    new Link('content'),
    new Link('import x from "y";'),
    new Link(''),
    new Link('  const a = 1;'),
    new Link('it\'s `x` "y"'),
  ]),
]);
const t = l.format();
console.log(t);
const back = new Parser().parse(t);
console.log(JSON.stringify(back[0].values[1].values.map((v) => v.id)));
console.log(
  new Parser()
    .parse("(a 'x\ny')")
    .map((x) => x.format())
    .join()
);
