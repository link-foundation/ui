// How a split's remembered sizes are written and read as Links Notation.
import { Link, Parser } from 'links-notation';

const text = new Link(
  null,
  ['sizes', '30.5', '69.5'].map((v) => new Link(v))
).format();
console.log(text);
const links = new Parser().parse(text);
console.log(JSON.stringify(links));
console.log(JSON.stringify(new Parser().parse('(sizes 30 70)')));
try {
  new Parser().parse('garbage ((');
} catch (error) {
  console.log('bad text throws:', error.name);
}
