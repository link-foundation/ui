import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
} from '@link-foundation/ui-links';
const server = createLinksServer({
  links: createMemoryLinks(),
  autoCreate: true,
});
const client = createSyncedLinks({ transport: connectInProcess(server) });
await client.query('() ((p: x y))');
console.log(JSON.stringify(linksToLino(client)));
