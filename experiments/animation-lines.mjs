// How ui-core projects several links on one line, and continuation lines.
import { parse } from '@link-foundation/ui-core';
const show = (t) => {
  const doc = parse(t, { checks: false });
  console.log(
    JSON.stringify(
      doc.roots.map((n) => ({
        id: n.id,
        kind: n.kind,
        props: n.properties.map((p) => [p.name, p.values]),
        unknown: n.unknown,
      }))
    )
  );
};
show('(a: timeline (play b)) (b: timeline (play a))');
show(`(press: animation (target ok) (duration 100ms)
  (track scale (key 0 1) (key 1 0.9)) (on pressed))`);
