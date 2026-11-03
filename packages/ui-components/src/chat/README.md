# Chat kit

Import `@link-foundation/ui-components/chat` to register `chat-list`,
`message-stream`, `message-bubble`, `composer`, `day-separator` and
`reasoning-trace`. Load `@link-foundation/ui-components/chat.css` and the
existing `controls.css` and `data.css`. The complete runnable example is
[`chat.html`](../../examples/chat.html) (serve the repository with
`node scripts/serve-static.mjs --port 4173`).

## One data contract

`parseChatData(textOrRawLinks)` reads the official Links Notation representation;
`chatDataToLino(records)` writes nested LiNo. Both validate unique IDs, scalar
fields, booleans and nonnegative integer counts. The result is an ordered array
of `{ id, kind, ...fields }`. Unknown scalar fields survive round trips so hosts
can carry metadata. References are record IDs, and optional fields stay absent.

```lino
c1: chat
  title 'Design review'
  unread 2
  can-edit false
  can-react true
  can-reply true
  max-attachments 2
alice: participant
  name Alice
m1: message
  chat c1
  sender alice
  time '2026-10-30T10:00:00Z'
  text Hello
m2: message
  chat c1
  sender me
  outgoing true
  reply-to m1
  status pending
  text 'Ready for review'
s1: step
  message m2
  parent none
  title Review
  state done
s2: step
  message m2
  parent s1
  title Contrast
  state done
```

The six record kinds are `chat`, `message`, `participant`, `attachment`,
`reaction` and `step`. Attachments refer to `message` and contain `name`, `url`,
`mime`, `size`; reactions contain `message`, `emoji`, `count`, `selected`; steps
contain `message`, `parent`, `title`, `state`, optional `text`. Messages can carry
`service true`, `unread true` and explicit delivery `status` (`pending`,
`sending`, `sent`, `delivered`, `read`, `failed`). The adapter marks outgoing
messages and supplies receipt/unread snapshots; the kit never interprets IDs.
All displayed text uses text nodes. Unsafe attachment URLs are rendered as text.

## Mount and actions

Use `mountDocument(container, lino, { parseOptions: { vocabulary:
chatVocabulary() }, chat: options })`. `options` contains:

- `data`: the record array or an observable `{ get(), subscribe(fn) }` snapshot.
- `windows`: named `createStreamWindow(source, limits)` instances.
- `clock: () => epochMilliseconds`, `locale`, `timeZone` and `labels` (translated
  day groups, actions, delivery states, composer, paging and status strings).
- `slots.message(message, {document})`: optional trusted renderer returning a
  Node or string (Markdown/diagrams belong to host renderers).
- `slots.before`, `slots.attachments`, `slots.after`: optional composer content,
  returning Nodes. Hosts enforce attachment counts and send attachment data in
  their adapter; `max-attachments` is published on the slot container and zero
  hides attachment content.
- `spaceTarget`: optional shared ancestor for `--composer-space`; by default the
  composer's parent. Put both stream and composer inside `.ui-chat-shell`.

```lino
stream: message-stream
  label Messages
  chat c1
  source history
compose: composer
  chat c1
```

A bubble and trace use `record <message-id>`; a day separator uses `time <ISO>`;
a chat list reads chat summaries from the snapshot. Without `source`, a stream
renders the snapshot's messages for its `chat`.

Bubbling events: `ui-chat-send` carries `{chat, text}`, `ui-chat-action` carries
`{action, message, selection}` (reaction buttons also carry `reaction`), and
`ui-chat-jump` carries `{id}`. The host performs network actions and updates the
snapshot. Capability flags default to unavailable; explicit message flags
can override chat flags. Context-menu target and multi-selection are independent.
Arrows move between messages, Space selects, Shift extends, Ctrl/Meta toggles,
Enter/ContextMenu/Shift+F10 opens the APG action menu, Escape clears selection.
Composer Enter sends; Shift+Enter inserts a newline; IME Enter is preserved.

## Contiguous history and scroll ownership

A source implements `load({before?, after?, around?, limit, signal})`, returning
`Promise<{messages, hasOlder, hasNewer}>`. Pages are oldest first, IDs unique,
cursors exclusive; an omitted cursor requests the newest page. `around` returns
a contiguous page containing the target. The source must report gaps with
`hasNewer`/`hasOlder`, never join disjoint pages. No transport is built in.

`createStreamWindow` defaults to `pageSize: 50`, `prefetch: 30`, `ceiling: 500`.
The ceiling bounds retained messages: loading older drops the newest end and
marks `hasNewer`; loading newer drops the oldest end and marks `hasOlder`.
Jump replaces the window, preserves the gap boundary and publishes `highlighted`.
A missing target or failed load preserves existing history and exposes `error`;
retry clears the error. Concurrent page calls coalesce; jumps abort stale loads.
`state()` returns a snapshot; `subscribe(fn)` returns an unsubscribe function.
`loadNewer()` may poll at the live tail after a host receives new messages.

The stream renders a measured virtual range, prefetches near the edges and
anchors keyed rows on prepend. It follows the bottom until the user scrolls up.
“Follow latest” resumes following within the loaded window; hosts can jump to
their newest known ID to replace a historical window. The composer publishes
its measured height in an animation frame after ResizeObserver; the stream
reserves that exact height. The textarea can exceed half the viewport.

The host owns windows: destroy renderer handles and call `window.disconnect()`
on teardown. Observers, menus, listeners and queued frames are cleaned up by the
renderer; disconnecting a window aborts its outstanding source load.

## Appearance

The four skin files in `skins/` are #19 token sets, with `dark` modes, adapted
from meta-sovereign's Unlicense `app.css`. Telegram, WhatsApp and Signal retain
15px, 7.5px and 18px bubble radii. `cards`, `compact`, `bubbles` are independent
token sets; concatenate their generated CSS after the chosen skin. `readTokens`,
`resolveTokens` and `toCss` from ui-tokens generate scoped CSS; the example
handles system color-scheme changes and skin/style switches. Selection and
bubble contrast tests check WCAG AA in both modes. Motion honors the user's
reduced-motion setting. No GPL/AGPL client code is included.

Model inspiration: meta-sovereign `chat-model.js`, `chat-view.js` and composer
geometry; formal-ai research informed interaction requirements only. Provider
imports, entity formats and receipt counters deliberately stay in adapters.
