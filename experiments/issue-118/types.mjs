// @ts-check
// Public declaration smoke check: tsc --noEmit --checkJs --strict --target es2022
// --module nodenext experiments/issue-118/types.mjs
import {
  createDeepClient,
  createSyncedTriplets,
} from '@link-foundation/ui-links';

const deep = createDeepClient(createSyncedTriplets());
try {
  const { data } = await deep.select({}, { remote: false });
  deep.minilinks.apply(data, 'typed-result');
  const count = await deep.select({}, { remote: false, aggregate: 'count' });
  count.data.toFixed();
  const subscription = deep.subscribe({ type_id: { _eq: 1 } }).subscribe({
    next: (result) => {
      if (Array.isArray(result.data)) {
        deep.minilinks.apply(result.data);
      }
    },
  });
  subscription.unsubscribe();
} finally {
  deep.close();
}
