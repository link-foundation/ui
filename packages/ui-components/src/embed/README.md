# Deferred provider posts

Import `@link-foundation/ui-components/embed` to register the `embed` DOM kind
and define `<ui-embed>` in the current browser. Provider adapters are separate
opt-in modules; importing the main package does not allow a provider or load
its script. No code or archived content from the unlicensed consumer site is
included.

```js
import {
  defineEmbedElement,
  embedVocabulary,
} from '@link-foundation/ui-components/embed';
import '@link-foundation/ui-components/embed/providers/x';
import '@link-foundation/ui-components/embed/providers/telegram';
import '@link-foundation/ui-components/embed/providers/vk';
import { mountDocument } from '@link-foundation/ui-dom';

// Also call this before rendering in an explicit window, e.g. jsdom.
defineEmbedElement(window);
mountDocument(container, text, {
  parseOptions: { vocabulary: embedVocabulary() },
});
```

The opt-in vocabulary extends the core vocabulary; pass another base vocabulary
to compose extensions. Provider post `id` is independent of the element's stable
link ID (`post` below).

```lino
post: embed
  provider x
  id 20
  toggle true
  archived: text 'Example archive supplied by the host'
```

The equivalent custom element accepts one element with `slot="fallback"`:

```html
<ui-embed provider="x" id="20" toggle="true">
  <article slot="fallback"><p>Example archived content</p></article>
</ui-embed>
```

Archive children must already be safe DOM: sanitize imported HTML with
`ui-convert` before inserting it. The embed never interprets an HTML string,
executes document-supplied code, or relaxes converted HTML's script/iframe
restrictions. Static HTML rendering includes the archive and no scripts.

## Options and lifecycle

Properties/attributes: `provider`, `id`, `hash`, `enabled` (default true),
`toggle` (default false), `root-margin` (default `400px`), `timeout` (default
12000 milliseconds), `script-timeout` (default 10000 milliseconds), `theme`
(`light`, `dark`, `system`), `locale` and `debug`. Boolean attributes accept
`true` and `false`; an empty boolean attribute means true. Prefer `enabled`
to defer a user's privacy choice indefinitely.

Validation happens before requesting a provider script or frame. A missing
provider, invalid identifier or unsafe adapter URL shows the archive directly.
Valid posts wait for IntersectionObserver; browsers without it load immediately.
Script promises are shared per document by URL. Failure, timeout or cancellation
of the last pending user removes the request from the cache. Successful SDKs
remain available for subsequent posts. A theme switch retains a shared pending
request while replacing the widget container.

`data-state` is `deferred`, `loading`, `ready`, `fallback` or `off`.
`data-loaded` appears only when ready. A provider's success callback or, for
adapters that permit it, an iframe's positive rendered height establishes
readiness. Iframes receive a
localized title if they lack one. The readiness deadline covers script loading
and widget rendering. A failed generation emits one bubbling, composed
`ui-embed-error` event with `{provider, id, reason}`. Reasons are
`invalid-provider-or-id`, `timeout`, `provider-error` and `unavailable`.

Archived children appear inside a native `<details>` under the live widget.
Off/failed widgets show them directly. The optional button switches between
live and archive modes; choosing live starts a fresh generation and clears the
failure. Theme/locale attribute updates preserve the user's archive choice.
UI strings default to English or Russian based on the locale.

The resolved scheme follows the nearest `data-scheme` and the system's
`prefers-color-scheme`; locale follows the nearest `lang` or `data-locale`.
Explicit `theme` and `locale` override inheritance. Changes replace the whole
provider container. Old promises and callbacks retain their detached container
and cannot clear or mark the new generation ready. Disconnecting the custom
element destroys its controller; reconnecting starts another. Destruction
cancels timers, observers, media listeners, pending script ownership, provider
cleanup and the widget container. The archived DOM is preserved.

`createEmbed(connectedHost, options)` offers the same lifecycle without a custom
element. It returns `{update(options), retry(), destroy()}`. Its camelCase
options include `rootMargin`, `scriptTimeout` and optional `labels`
(`title`, `archive`, `showEmbed`, `showArchive`). `debug: true` logs each state
transition and fallback reason; an optional `log` callback receives those
messages. Logging is off by default. `loadEmbedScript(document, url, options)`
is a lower-level page-owned loader; widgets use disposable ownership internally.

Pass an existing `archive` element when the host owns the layout and controls.
The controller leaves it in place, shows it when the embed is off or fails,
and restores its original `hidden` attribute on destroy. The archive must
sit outside the live widget. Use `retry()` from your own controls and
`update({ enabled: false })` to show the archive. The controller attaches a
toggle only when `toggle: true` is requested with a host archive. Focus
stays on controls that remain visible and moves to the archive or live region
when the focused content is hidden or removed.

```js
const embed = createEmbed(liveHost, {
  provider: 'x',
  id: '20',
  archive: archivedPost,
  labels: { title: 'Original post' },
  widgetOptions: { x: { width: 550, align: 'center' } },
});
retryButton.addEventListener('click', () => embed.retry());
```

For VK pass `widgetOptions: { vk: { width: '100%' } }`. X and VK accept
additional SDK options in their corresponding objects. The controller and
adapters set the current theme, locale, X privacy preference and VK readiness
callback. Call `update({ widgetOptions })` to replace the options and restart
the widget.

## Trusted provider adapters

```js
import { registerEmbedProvider } from '@link-foundation/ui-components/embed';

const unregister = registerEmbedProvider('example', {
  script: 'https://provider.example/widget.js', // null for a standalone frame
  validate: ({ id }) =>
    typeof id === 'string' && /^[0-9]+$/.test(id.trim()) && id.trim() === id,
  url: ({ id }) => `https://provider.example/post/${encodeURIComponent(id)}`,
  render(container, context) {
    // Trusted application code calls the official provider SDK here.
    // context: id, hash, url, theme, locale, labels, widgetOptions, window, signal,
    // ready(), unavailable(). Return a cleanup function, optionally in a promise.
    return context.window.provider.render(container, context);
  },
});
```

Registration is an application allow-list, not a document capability. It accepts
only HTTPS script URLs without credentials and function hooks. `url` runs only
after validation, and its result is checked for HTTPS before reaching `render`.
Set `readiness: 'provider'` for adapters that require an explicit `ready()`
signal even when an iframe has a positive height. Adapters should honor
`signal`, report unavailable posts, and release any
resources they create. Container-scoped asynchronous work remains isolated even
if a provider ignores cancellation. Third-party SDKs may retain their own global
page state; the component does not modify SDK internals.

- **X:** digits only; uses the official `widgets.createTweet` promise with
  theme, language and do-not-track enabled. A missing result means unavailable.
- **Telegram:** public `channel/number` identifiers. The official post widget
  runs in a disposable local iframe and controls the dimensions of the remote
  frame. The outer iframe follows those dimensions. A browser `load` event
  alone leaves the embed loading. The SDK accepts the theme, and the local
  iframe and titles use the resolved locale. Telegram controls the language of
  the remote post. Blocked widgets fall back on SDK failure or at the readiness
  deadline.
- **VK:** `owner_post` (negative owners allowed), plus a required alphanumeric,
  underscore or hyphen hash; uses the official `VK.Widgets.Post` API and its
  iframe or `onReady` callback for readiness. The container sets `color-scheme`
  and language and forwards theme/locale preferences to the SDK; the SDK controls
  which presentation preferences it supports. The SDK owns resizing. Its
  per-widget RPC endpoint is released on cleanup. As with any cross-origin widget,
  unavailable content can only be reported when the provider exposes a signal.

The component never reads cross-origin documents or processes `postMessage`
height data. Frame title/size observation reads only the local embedding DOM.

### Telegram post availability

Telegram's widget can resize a “Post not found” document just like a public
post. Supply `widgetOptions.telegram.checkAvailability` if a confirmed
deleted or private post should go directly to the archive. The callback runs
after validation and viewport deferral, before the SDK is requested. A
`false` result reports `unavailable`. Pass its `signal` to any asynchronous
work so that changing the post, locale or theme, or destroying the controller,
cancels the check. Without a host check, the official widget renders Telegram's
own missing-post response.

```js
createEmbed(liveHost, {
  provider: 'telegram',
  id: 'channel/42',
  archive: archivedPost,
  widgetOptions: {
    telegram: {
      async checkAvailability({ id, signal }) {
        const response = await fetch(
          `/api/telegram-post?post=${encodeURIComponent(id)}`,
          { signal }
        );
        if (response.status === 404) return false;
        if (!response.ok) throw new Error('Post availability check failed');
        return true;
      },
    },
  },
});
```

The example endpoint is provided by the application. It can check known
archive metadata or use the Telegram API, such as
[`channels.getMessages`](https://core.telegram.org/method/channels.getMessages)
for a channel post.

Provider references: [X factory](https://developer.x.com/en/docs/x-for-websites/embedded-tweets/javascript-factory-function),
[Telegram post widget](https://core.telegram.org/widgets/post),
[VK post widget (archived)](https://web.archive.org/web/20260415094236/https://dev.vk.com/ru/widgets/post).

## Verification

Run `node --test packages/ui-components/tests/embed/*.test.js` for deterministic
manual-clock lifecycle and adapter tests. Run
`npx playwright test packages/ui-components/e2e/embed.e2e.mjs --workers=1` for
viewport loading, shared requests, theme races, malicious IDs, timeout/error,
keyboard controls, iframe titles and axe audits in live/archive/failure states.
The browser tests mock the provider SDK and do not contact a live social site.
Run the neighboring `telegram.e2e.mjs` tests for content sizing at two widths,
blocked and unavailable posts, host-rendered archives and keyboard focus.

Start `node scripts/serve-static.mjs` and open
`/packages/ui-components/examples/embed.html` for the runnable example; `?far`
places it below the fold. In a normal browser this example loads the official X
SDK and falls back if the example post is unavailable.
