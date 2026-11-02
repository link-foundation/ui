# @link-foundation/ui-store

A UI document of [`@link-foundation/ui-core`](../ui-core/README.md) as a
mutable links network: every element has a stable ID, every change is an
event, changes are grouped in transactions, every transaction can be undone
and redone, and all of them form an ordered operation log that can be written
as Links Notation and replayed.

The store is the editing layer of the framework: renderers subscribe to its
events, and the dev-mode editor changes the document only through its
operations. It has no runtime dependency but `@link-foundation/ui-core`;
`openPersistentStore` saves it to IndexedDB (see "Persistence").

```js
import { createStore, logToLino } from '@link-foundation/ui-store';

const store = createStore({
  text: "(main: stack (ok: button (label 'OK')) (text 'Hello'))",
});

store.subscribe((events, entry) => {
  for (const e of events) console.log(entry.tx, e.type, e.id);
});

store.transaction(
  'Edit label',
  () => {
    store.setProp('ok', 'label', ['Cancel']);
    store.move('ok', 'main', 1);
  },
  { origin: 'devmode' }
);
store.undo();

console.log(logToLino(store.log()));
// (tx 1 (origin devmode) (label 'Edit label') (setProp ok label Cancel) (move ok (parent main) (at 1)))
// (tx 2 (origin undo) (undoes 1) (move ok (parent main) (at 0)) (setProp ok label OK))
```

The complete example is `examples/ui-store-basics.mjs` in the repository.

## API

### `createStore(options?)`

| Option            | Meaning                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `document`        | A ui-core document (`{ roots, unknown }`, as `parse` returns it) to start from.                                |
| `text`            | Links Notation to start from, read with ui-core `parseOrThrow` (with `parseOptions`). Ignored with `document`. |
| `historyLimit`    | How many transactions can be undone; the oldest are dropped first. Default `500` (`DEFAULT_HISTORY_LIMIT`).    |
| `onListenerError` | `(error, { listener, events, entry })`, called when a listener throws. Default: `console.error`.               |
| `parseOptions`    | Options of `parseOrThrow` for `text`.                                                                          |
| `ids`             | The store IDs of every element in pre-order (see "ID rules"); by default anonymous elements get generated IDs. |

Without `document` and `text` the store starts empty.

### Reading

| Method             | Returns                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `get(id)`          | A frozen view `{ id, name, kind, positional, properties, unknown, parentId }`, or `undefined` for an unknown ID. |
| `has(id)`          | Whether an element has this ID.                                                                                  |
| `roots()`          | The IDs of the root elements, in order.                                                                          |
| `children(id)`     | The IDs of the children of an element, in order.                                                                 |
| `parentOf(id)`     | The ID of the parent; `null` for a root element.                                                                 |
| `indexOf(id)`      | The position of an element among its siblings.                                                                   |
| `toDocument()`     | The document as a ui-core document (anonymous elements stay anonymous).                                          |
| `toLino(options?)` | The document as Links Notation, written by ui-core `format(document, options)`.                                  |

`name` in a view is the id the element has in the document, or `null` for an
anonymous element. Every array the store returns is frozen and is never
changed afterwards: a view taken before a change still shows the old state.

### Changing

Every change is one of seven operations. Outside a transaction each call is a
transaction of its own.

| Method                          | Operation                                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insert(parentId, index, node)` | Insert a subtree (`{ id?, kind, positional?, properties?, children?, unknown? }`, the ui-core node shape) under `parentId` (`null`: a root) at `index` (`undefined`: at the end). Returns the ID of its root.  |
| `remove(id)`                    | Remove an element with its subtree.                                                                                                                                                                            |
| `move(id, parentId, index?)`    | Move an element (with its subtree) to another position. Moving an element into itself or its descendants throws `cycle`.                                                                                       |
| `setProp(id, name, values)`     | Set the values of a property (`label` → `['OK']`). The last property with this name is replaced (last wins, as in `docs/spec/ordering-and-ids.md`); without one it is appended.                                |
| `removeProp(id, name)`          | Remove the last property with this name.                                                                                                                                                                       |
| `setPositional(id, values)`     | Set the positional values of an element (`'Hello'` of `(greeting: text 'Hello')` → `['Hi']`). They are atoms (`docs/spec/elements.md`): any other value throws `bad-value`. IDs, properties and children stay. |
| `rename(id, to)`                | Give an element a new ID (`to: null`: make it anonymous, with a new generated ID). Returns the new ID.                                                                                                         |
| `apply(op)`                     | Apply an operation given as data (the forms below); returns it as applied.                                                                                                                                     |

Operations as data:

```js
{ op: 'insert', parentId, index?, node, ids? }
{ op: 'remove', id }
{ op: 'move', id, parentId, index? }
{ op: 'setProp', id, name, values, index? }   // index: insert a new property there
{ op: 'removeProp', id, name, index? }        // index: remove the property there
{ op: 'setPositional', id, values }           // values: atoms (strings)
{ op: 'rename', id, to, as? }                 // as: the generated ID for to: null
```

An operation that throws changes nothing. Bad input throws a `StoreError`
with a `code`: `unknown-id`, `duplicate-id`, `bad-index`, `cycle`,
`unknown-property`, `bad-op`, `bad-node`, `bad-value`, `bad-log`,
`in-transaction`, `async-transaction`.

### Transactions

```js
store.transaction(label, fn, { origin });
store.transaction(fn, { origin }); // without a label
```

`fn` runs synchronously and its return value is returned. All operations of
`fn` are one transaction: one log entry, one undo step, and **one** listener
call with all their events (1,000 `setProp` calls give one call with 1,000
events). If `fn` throws, every change it made is rolled back, nothing is
emitted or logged, and the error is thrown again. A transaction inside
another one joins it; if the inner one throws and the outer one catches the
error, only the inner changes are rolled back. `fn` must not return a promise
(`async-transaction`). `origin` defaults to `'user'` (`DEFAULT_ORIGIN`); use
it to tell apart where a change came from (`'devmode'`, `'sync'`, ...). A
transaction without operations is not committed.

### Undo and redo

`undo()` and `redo()` return `false` when there is nothing to undo or redo;
`canUndo()` and `canRedo()` tell it in advance. Undo applies the inverse
operations of the last transaction, last first, as a **new** transaction with
the origin `'undo'` and `undoes: <tx>`; redo applies the operations again as a
transaction with the origin `'redo'` and `redoes: <tx>`. So the log only grows,
and the listeners get the undo like any other change. Undo restores the exact
previous state, IDs included: a removed subtree comes back with the IDs it
had. A new transaction (not an undo or redo) clears the redo stack. Calling
`undo` or `redo` inside a transaction throws `in-transaction`.

### Events

`subscribe(listener)` returns a function that removes the listener. After
every committed transaction each listener is called once as
`listener(events, entry)`: `events` is the frozen list of the changes in
order, and `entry` is the log entry of the transaction.

```ts
{
  seq: number;          // increases by one with every event of the store
  tx: number;           // the transaction
  origin: string;       // 'user', 'undo', 'redo', or the origin given
  type: 'insert' | 'update' | 'remove' | 'move' | 'rename';
  id: string;           // the element (for rename: its new ID)
  parentId: string | null;
  index: number;        // the position among its siblings
  props: readonly UiProperty[] | null; // the properties after the change (remove: null)
  prop?: string;        // update only: the changed property (left out: positional values)
  before: unknown;
  after: unknown;
}
```

| `type`               | `before`                  | `after`                   |
| -------------------- | ------------------------- | ------------------------- |
| `insert`             | `null`                    | the view of the element   |
| `remove`             | the view of the element   | `null`                    |
| `update`             | the old values, or `null` | the new values, or `null` |
| `update` (no `prop`) | the old positional values | the new positional values |
| `move`               | `{ parentId, index }`     | `{ parentId, index }`     |
| `rename`             | the old ID                | the new ID                |

Inserting a subtree gives one `insert` event per element, parents first;
removing one gives one `remove` event per element, children first, so each
event's `index` is valid at the moment it happens. A listener that throws does
not stop the other listeners and does not undo the transaction: the error goes
to `onListenerError`. Changes a listener makes are new transactions, emitted
after the current call round.

### The operation log

`log()` returns every committed transaction, oldest first:

```ts
{ tx, origin, label, undoes?, redoes?, ops }
```

Each operation is stored as applied, with every choice the store made filled
in (the index of an append, the IDs of inserted elements), so applying the log
to the starting document gives the same document with the same IDs:
`store.replay(entries)` applies entries as new transactions with their origin
and label (`undoes` and `redoes` are not carried over: replayed transactions
are plain changes).

`logToLino(entries)` writes the log as Links Notation, one transaction per
line, and `logFromLino(text)` reads it back (both through ui-core
`formatLinks` and `parseLinks`, no regular expressions):

```lino
(tx 4 (origin devmode) (label 'Edit label') (setProp ok label 'Cancel'))
(tx 5 (origin undo) (undoes 4) (setProp ok label 'OK'))
```

| Operation       | Links Notation                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `insert`        | `(insert (parent p) (at i) (ids id…) (node (id x) (kind k) (positional …) (properties (name values…)…) (unknown …) (children (node …)…)))` |
| `remove`        | `(remove id)`                                                                                                                              |
| `move`          | `(move id (parent p) (at i))`                                                                                                              |
| `setProp`       | `(setProp id name values…)`, `(setProp (at i) id name values…)`                                                                            |
| `removeProp`    | `(removeProp id name)`, `(removeProp (at i) id name)`                                                                                      |
| `setPositional` | `(setPositional id values…)` (`(setPositional id)`: no positional values)                                                                  |
| `rename`        | `(rename id to)`, `(rename id (anonymous as))`                                                                                             |

A root position has no `(parent …)`; empty sections of a node are left out.
Text that is not in this format throws a `StoreError` with the code
`bad-log`.

## Persistence

`openPersistentStore(options)` opens (or creates) the IndexedDB database
`link-ui-<name>` and returns `{ store, persistence }`. Every committed
transaction of `store` is written to the database (write-through), so the
document, with its store IDs, comes back when the page is opened again.

```js
import { openPersistentStore } from '@link-foundation/ui-store';

const { store, persistence } = await openPersistentStore({
  name: 'demo',
  initialText: "(ok: button (label 'OK'))",
});
store.setProp('ok', 'label', ['Cancel']); // queued to IndexedDB
await persistence.flush(); // all writes are done
```

The complete example is `examples/ui-store-persistence.mjs` in the
repository.

| Option             | Meaning                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `name`             | The database is `link-ui-<name>` (`databaseName(name)`).                                              |
| `indexedDB`        | The `IDBFactory` to use; default `globalThis.indexedDB` (tests pass `fake-indexeddb`).                |
| `initialText`      | Links Notation of the document when the database has no data yet.                                     |
| `channel`          | Tell other tabs about writes through a `BroadcastChannel` (default `true`).                           |
| `BroadcastChannel` | The constructor to use; default `globalThis.BroadcastChannel`.                                        |
| `storeOptions`     | More options of `createStore` (`historyLimit`, `onListenerError`).                                    |
| `bundleLimits`     | The default limits of `importBundle` (`{ maxDepth, maxInputSize }`, `DEFAULT_BUNDLE_LIMITS`).         |
| `onError`          | `(error)` when a write fails; default `console.error`. `flush()` also rejects with the first failure. |

`store` has the methods of `createStore`, and stays valid when `reload()` or
`importBundle()` replaces the document: its `subscribe` listeners are kept.
Undo and redo work for the transactions made since the store was loaded.

| `persistence.`                | Does                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `flush()`                     | Resolves when every queued write is done; rejects with the first write that failed since the last `flush()`.                  |
| `compact()`                   | Writes the current document as the snapshot and deletes the log rows it contains (all of them unless edits are still queued). |
| `exportBundle()`              | The `.lino` bundle of the database (below).                                                                                   |
| `importBundle(text, limits?)` | Replaces everything with a bundle in one IndexedDB transaction.                                                               |
| `reload()`                    | Reads the database again; `onReload(listener)` is called after it (and after `importBundle`).                                 |
| `readDoublets()`              | The doublets of the snapshot as stored: `{ links, names, roots }`.                                                            |
| `close()`                     | Waits for the queued writes and closes the database and the channel; later edits stay in memory only.                         |
| `destroy()`                   | Closes and deletes the database.                                                                                              |

`importBundle` and `destroy` replace or delete the user's data: the UI asks
for confirmation before calling them; this package only exposes the calls.

### The database

The database version is `SCHEMA_VERSION` (1):

| Object store | Key          | Indexes                             | Rows                                                                 |
| ------------ | ------------ | ----------------------------------- | -------------------------------------------------------------------- |
| `links`      | `index`      | `source`, `target`, `source+target` | `{ index, source, target }`: the doublets of the snapshot            |
| `names`      | `name`       | `index` (unique)                    | `{ name, index }`: the point of each reference string                |
| `log`        | `seq` (auto) | `tx`                                | `{ seq, tx, lino }`: one committed transaction, as `logToLino` text  |
| `meta`       | `key`        |                                     | `schemaVersion`, `roots`, `ids` (store IDs, pre-order), `snapshotTx` |

Loading decodes the snapshot (`links`, `names`, `meta.roots`) and replays the
`log` rows with `tx > snapshotTx`. Each write appends one `log` row in one
`readwrite` transaction; its `tx` follows the largest `tx` in the database,
so transaction numbers keep increasing across sessions and tabs (`undoes` and
`redoes` refer to these numbers).

### The doublets encoding

`encodeDocument(document)` gives `{ links, names, roots }`; `decodeDocument`
reads it back (a `StoreError` `bad-doublets` for any other form). Every link
is a doublet `(index, source, target)` of integers from 1, as in
[doublets-web](https://github.com/linksplatform/doublets-web):

- Each distinct string (`ok`, `button`, `label`, `OK`) is a **point**
  `(i, i, i)`; `names` maps it to `i`. Every other link is a pair, and equal
  pairs are created once.
- A sequence `(a b c)` is a left fold from the empty list `nil = (list,
end)`: `((nil, a), b), c)`. Its left side is never a point, so no pair of a
  point with itself (which would be that point) is needed.
- An element is `(point id, body)`, or the body alone when it is anonymous;
  the body is the sequence of five sequences `(kind positional properties
children unknown)`. A property is `(point name, values)`.
- A raw value is a point (a string), `(nil, items)` (a link) or
  `(point id, values)` (a link with an id).
- `roots` is `[root elements, top-level links that are not elements]`.

### Bundles

`exportBundle()` gives one Links Notation document: the header, the snapshot
as Links Notation, and the transactions after it as `logToLino` lines:

```lino
(ui_store_bundle (schema 1) (name demo) (snapshot_tx 12))
(document (ok: button (label OK)))
(tx 13 (origin devmode) (setProp ok label Cancel))
```

Two more links follow `document` when they are needed:

- `(document_tree …)`: when the document text would read back as a different
  document. A store accepts any property name, while ui-core reads a property
  that its vocabulary does not know as an unknown sublink (or, named like a
  kind, as a child element). The tree tags every part, e.g. `(e (id ok) (kind
button) (pos) (props (p label (s OK))) (children) (unknown))`, and is used
  instead of the text.
- `(ids …)`: the store IDs in pre-order, when anonymous elements have IDs that
  a new store would not generate.

`importBundle(text, limits?)` reads the bundle with ui-core `parseLinks`
within `maxDepth` and `maxInputSize` (a `UiParseError` above them), checks the
header (`bad-bundle`), the transactions (`bad-log`, increasing `tx` after
`snapshot_tx`) and replays them on a new store. Only then is the database
replaced, in one transaction; on any error nothing changes.

Values that `formatLinks` cannot write (an empty link `()` or a link with an
id but no values, see ui-core) lose that form in the `log` and in bundles,
as in `logToLino`.

### doublets-web

`copyToDoubletsWeb(encoded, unitedLinks)` creates the doublets in a
`doublets-web` `UnitedLinks` instance in index order (`create()` then
`update(index, source, target)`) and returns the map from each index to the
index in `unitedLinks` (the same numbers when it was empty). `doublets-web`
is an optional peer dependency: `openDoubletsWeb()` loads it with a dynamic
`import()` only when called and returns `{ module, links }`.

```js
const { links } = await openDoubletsWeb();
copyToDoubletsWeb(await persistence.readDoublets(), links);
links.count(); // the number of doublets
```

### Any doublets storage

`writeDocumentLinks(encoded, links, names?)` writes the same doublets into any
storage with `create()` and `update(id, source, target)`: the storages of
[`@link-foundation/ui-links`](../ui-links/README.md) (memory, SQLite,
doublets-web, IndexedDB, localStorage and Links Notation text through its
persistence adapters, or a synced client of a links server). The storage may
hold other links; the document gets new addresses. It returns
`{ names, roots }`: each string point and the roots at their addresses. With a
names store (`setName(id, name)`, like ui-links `createNames()`), the points
are named there too.

`readDocumentLinks(links, { names, roots })` reads only the links reachable
from `roots` (with `each(handler, { id, from_id, to_id })`) and decodes them;
`names` is that map or a names store (`getName(id)`). A missing link is a
`StoreError` `bad-doublets`. Nothing is imported from ui-links: the storage is
duck-typed.

```js
import { createMemoryLinks, createNames } from '@link-foundation/ui-links';

const links = createMemoryLinks();
const names = createNames();
const where = writeDocumentLinks(encodeDocument(document), links, names);
readDocumentLinks(links, { names, roots: where.roots }); // the document
```

### Several tabs

After each write, the store posts `{ tx }` on the
`BroadcastChannel('link-ui-<name>')`; the other tabs call `reload()`. There is
no conflict resolution: the last writer wins, and a reload drops the undo
history of that tab.

## ID rules

- An element with an id in the document (`(ok: button …)`) has that id as its
  store ID.
- An anonymous element gets a generated ID: `_1`, `_2`, … (the prefix is
  `GENERATED_ID_PREFIX`). The specification reserves no prefix, so a
  generated ID skips every ID in use, and a document id such as `_1` is kept.
- An ID names one element for the life of the store: the generator never
  returns an ID twice, even after its element is removed, so undoing the
  removal brings back the same ID.
- IDs are unique: inserting or renaming to an ID in use throws
  `duplicate-id`.
- An ID changes only through `rename`; the `rename` event and log entry tell
  the old and the new ID. Insert, remove, move and property changes never
  change IDs.
- Generated IDs are not written by `toLino` or `toDocument`: anonymous
  elements stay anonymous, so reading the output again can number them
  differently. Reading a document and writing it back without changes gives
  the same text as ui-core `format`.

- `createStore({ ids })` gives the elements the store IDs listed in
  pre-order instead (a named element's ID must be its name), so a store read
  back from a snapshot keeps the generated IDs that its operation log refers
  to.

`createIdGenerator(usedIds?)` is the generator the store uses, exported for
tools that need the same IDs.

## License

[Unlicense](LICENSE)
