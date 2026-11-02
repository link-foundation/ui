// How links-notation reads and writes the shapes the ui-store log uses.
import { Link, Parser } from 'links-notation';
const p = new Parser();
const show = (t) => console.log(JSON.stringify(t), '->', JSON.stringify(p.parse(t)), '| groups', JSON.stringify(p.parseGroups(t).map(g=>g.element)));
show("(tx 4 (origin devmode) (label 'Edit label') (setProp ok label 'Cancel'))\n(tx 5 (origin undo) (undoes 4) (setProp ok label OK))\n");
show('(label)');
show('(a ())');
show('(a (b))');
show('(a (x: b c) (y:))');
show("(a '' 'x y' \"it's\")");
const l = new Link(null, [new Link('tx'), new Link(null, []), new Link(null,[new Link('b')]), new Link('')]);
console.log(l.format());
console.log(new Link(null, [new Link('x')]).format());
