// Runs the query lines the README shows, against a server in triplet mode.
import {
  createLinksServer,
  createMemoryLinks,
} from '@link-foundation/ui-links';

const session = createLinksServer({
  links: createMemoryLinks(),
  triplets: true,
}).session();
for (const request of [
  '() ((3: 3 0 0))',
  '(set-name: (3 Person))',
  '() ((Knows Alice Bob))',
  '(($i: Person $f $t)) (($i: Person $f $t))',
  '()',
]) {
  console.log(
    request,
    '\n  ->',
    session.request(request).replaceAll('\n', '\n     ')
  );
}
