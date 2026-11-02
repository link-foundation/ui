// Replays the query examples of link-cli's README on the ui-links engine.
import { createMemoryLinks } from '../packages/ui-links/src/memory.js';
import { createNames } from '../packages/ui-links/src/names.js';
import { runQuery } from '../packages/ui-links/src/query.js';
import { linksToLino } from '../packages/ui-links/src/lino.js';

const show = (c) =>
  c === null ? '()' : `((${c.id}: ${c.from_id} ${c.to_id}))`;
function session(queries, options = {}) {
  const links = createMemoryLinks();
  const names = createNames();
  for (const q of queries) {
    try {
      const changes = runQuery({ links, names, ...options }, q);
      console.log(`> ${q}`);
      for (const { before, after } of changes) {
        console.log(`  ${show(before)} ${show(after)}`);
      }
    } catch (error) {
      console.log(`> ${q}\n  ! ${error.message}`);
    }
    console.log(linksToLino(links, { names }).replace(/^/gm, '    '));
  }
}
session([
  '() ((1 1))',
  '() ((2 2))',
  '((($i: $s $t)) (($i: $s $t)))',
  '((($i:)) (($i:)))',
  '((1: 1 1)) ((1: 1 2))',
  '((1 2)) ()',
  '((2 2)) ()',
]);
session([
  '() ((1 1) (2 2))',
  '((1: 1 1) (2: 2 2)) ((1: 1 2) (2: 2 1))',
  '((($index: $source $target)) (($index: $target $source)))',
  '((* *)) ()',
]);
session(['() (((m a) (m a)))', '(((m a) (m a))) (((p a) (p a)))'], {
  autoCreate: true,
});
session(['() (((m a) (a m)))'], { autoCreate: true });
session(
  ['() ((p: x y))', '() ((p: x y))', '((p: x y)) ((p: y x))', '((p: * *)) ()'],
  { autoCreate: true }
);
session(['() ((1 1))', '((1: 1 1)) ((1: 1 7))']);
