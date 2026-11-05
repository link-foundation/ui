import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createDeepClient,
  createSyncedDeepLinks,
} from '../../packages/ui-links/src/index.js';
import { startDeepClink } from '../lib/deep-clink.mjs';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

// A recorded core package exported by clink's permissively licensed fixtures.
const fixture =
  'https://raw.githubusercontent.com/link-foundation/link-cli/e183f0dbb891c0252c7aad53b47a454a8d848eaa/docs/protocol/graphql/deep-core.json';
export async function startDeepcase() {
  const file = resolve('examples/deepcase/dist/core.json');
  await mkdir(resolve('examples/deepcase/dist'), { recursive: true });
  let rows;
  try {
    rows = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const response = await fetch(fixture);
    if (!response.ok) {
      throw new Error(`Cannot fetch core fixture: ${response.status}`);
    }
    rows = await response.json();
    await writeFile(file, JSON.stringify(rows));
  }
  const server = await startDeepClink({ rows });
  let http;
  const synced = createSyncedDeepLinks({ url: server.url });
  const deep = createDeepClient(synced);
  try {
    await deep.select({});
    // This demo owns these ordinary schema links. The viewer resolves both
    // names even when no opened handlers exist. No handler runtime is supplied.
    const type = await deep.id('@deep-foundation/core', 'Type');
    const contain = await deep.id('@deep-foundation/core', 'Contain');
    const pkg = (
      await deep.insert({
        type_id: await deep.id('@deep-foundation/core', 'Package'),
        string: { data: { value: '@deep-foundation/deepcase-opened' } },
      })
    ).data[0].id;
    for (const name of ['Opened', 'OpenedHandler']) {
      const id = (await deep.insert({ type_id: type })).data[0].id;
      await deep.insert({
        type_id: contain,
        from_id: pkg,
        to_id: id,
        string: { data: { value: name } },
      });
    }
    http = await startStaticServer({
      mounts: [{ prefix: '/', dir: resolve('examples/deepcase') }],
    });
    return {
      url: `${http.url}?endpoint=${encodeURIComponent(server.url)}`,
      close: async () => {
        await http.close();
        await server.close();
      },
    };
  } catch (error) {
    await http?.close();
    await server.close();
    throw error;
  } finally {
    deep.close();
    synced.close();
  }
}
