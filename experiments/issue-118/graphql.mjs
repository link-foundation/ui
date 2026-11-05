// Focused probe of the released clink endpoint; no substitute server.
import assert from 'node:assert/strict';
import {
  createDeepClient,
  createSyncedDeepLinks,
} from '../../packages/ui-links/src/index.js';

const operations = [];
const synced = createSyncedDeepLinks({
  url: process.env.DEEPCASE_ENDPOINT ?? 'http://127.0.0.1:3198/v1/graphql',
  trace: (operation) => operations.push(operation),
});
const deep = createDeepClient(synced);
try {
  const core = await deep.id('@deep-foundation/core');
  assert.ok(core);
  const type = await deep.id('@deep-foundation/core', 'Type');
  const node = (
    await deep.insert({
      type_id: type,
      string: { data: { value: 'hello 🌍' } },
    })
  ).data[0];
  assert.equal(node.value.value, 'hello 🌍');
  assert.equal(
    (
      await deep.select({
        _and: [{ type_id: type }, { string: { value: 'hello 🌍' } }],
      })
    ).data[0].id,
    node.id
  );
  await deep.update({ link_id: node.id }, { value: '' }, { table: 'strings' });
  assert.equal((await deep.select(node.id)).data[0].value.value, '');
  await deep.delete(node.id);
  assert.equal((await deep.select(node.id)).data.length, 0);
  console.log('Native GraphQL CRUD and values passed', {
    core,
    type,
    operations: operations.length,
  });
} finally {
  deep.close();
  synced.close();
}
