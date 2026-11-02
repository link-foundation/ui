// Probe: the doublets-web 0.1.3 API that the ui-links storages implement.
import { Link, LinksConstants, UnitedLinks } from 'doublets-web';

const links = new UnitedLinks(new LinksConstants());
const c = links.constants;
console.log('constants', {
  any: c.any,
  _continue: c._continue,
  _break: c._break,
  _null: c._null,
  itself: c.itself,
  error: c.error,
  skip: c.skip,
  index: c.index_part,
  source: c.source_part,
  target: c.target_part,
});
const a = links.create();
console.log('create ->', a, 'count', links.count());
console.log('update ->', links.update(a, a, a));
const b = links.create();
links.update(b, a, b);
const d = links.create();
links.update(d, b, a);
const seen = [];
const r = links.each((link) => {
  seen.push([link.id, link.from_id, link.to_id]);
  return c._continue;
});
console.log('each ->', r, seen);
const q = [];
links.each(
  (link) => {
    q.push([link.id, link.from_id, link.to_id]);
    return c._continue;
  },
  new Link(c.any, a, c.any)
);
console.log(
  'each source=a',
  q,
  'count',
  links.count(new Link(c.any, a, c.any)),
  'count id',
  links.count(new Link(b, c.any, c.any))
);
const stop = [];
console.log(
  'each break ->',
  links.each((link) => {
    stop.push(link.id);
    return c._break;
  }),
  stop
);
console.log('delete ->', links.delete(d), 'count', links.count());
try {
  console.log('delete missing ->', links.delete(77));
} catch (e) {
  console.log('delete missing throws', String(e));
}
try {
  console.log('update missing ->', links.update(77, 1, 1));
} catch (e) {
  console.log('update missing throws', String(e));
}
const e = links.create();
console.log('reused id after delete:', e);
console.log(
  'delete in use ->',
  (() => {
    try {
      return links.delete(a);
    } catch (x) {
      return `throws ${x}`;
    }
  })(),
  'count',
  links.count()
);
