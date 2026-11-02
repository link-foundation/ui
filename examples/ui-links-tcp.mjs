// Usage of @link-foundation/ui-links over TCP: a links server framed like
// `clink --serve`, link-cli's own JavaScript client, and a synced client
// that gets the changes pushed.
// Run: node examples/ui-links-tcp.mjs
import { connectTcp } from '@link-foundation/link-cli-client/tcp';
import {
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
} from '@link-foundation/ui-links';
import { connectLinks, listenLinks } from '@link-foundation/ui-links/tcp';

const server = createLinksServer({ links: createMemoryLinks() });
const listener = await listenLinks(server, { port: 0 });
console.log('serving on', listener.address);

const cli = await connectTcp(listener.address);
const transport = await connectLinks(listener.address);
const synced = createSyncedLinks({ transport });
synced.onChange(({ after, origin }) => console.log(origin, after));

try {
  await synced.subscribe([]);
  // link-cli's client writes; the synced client is told.
  await cli.create(0, 0);
  await cli.update(1, 1, 1);
  await cli.setName(1, 'root');
  await new Promise((resolve) => setTimeout(resolve, 50));
  console.log(linksToLino(synced)); // (1: 1 1)

  // The synced client writes; link-cli's client reads it back.
  const x = synced.create();
  synced.update(x, 1, x);
  await synced.flush();
  console.log(await cli.exportLinks());

  // A substitution query, run on the server.
  const changes = await synced.query('((1: 1 1)) ((1: 1 2))');
  console.log(changes.map(({ before, after }) => [before, after]));
} finally {
  await cli.close();
  await transport.close();
  await listener.close();
}
