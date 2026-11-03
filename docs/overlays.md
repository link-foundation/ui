# Overlays and navigation

Import `@link-foundation/ui-components/overlays` before mounting a document
with ui-dom, and load `@link-foundation/ui-components/overlays.css`. The
shared dialect includes all fifteen kinds; the gallery at
`packages/ui-components/e2e/pages/overlays.html` loads the LiNo stories directly.
Serve it with `node scripts/serve-static.mjs`.

`overlayController(handle.nodeFor(id))` exposes `open()` and `close()`.
`open` properties also control dialogs, drawers, popovers and menus. An
`anchor` names a rendered link ID or a DOM ID. Context menus bind only to that
anchor; other right clicks retain the browser menu. Handlers receive `target`
separately from the application's `selection`, provided by
`options.overlays.selection()`. Right click, ContextMenu, Shift+F10 and a
600 ms touch hold open a context menu; movement, cancellation and release
cancel the pending hold.

```lino
confirm: dialog
  title 'Delete message?'
  body
    text 'This cannot be undone.'
  actions
    cancel: button
      label Cancel
      on press
        emit close
    delete: button
      label Delete
      on press
        emit delete
  on close
    emit closed
```

Titles name dialog surfaces. Body and actions are regular ui-dom documents;
action names remain data. Native `showModal()` makes the background inert,
and the shared focus helpers trap Tab and restore the opener. Alert dialogs
have no light dismiss. Drawers use the same behavior, with `modal false`
selecting a docked non-modal dialog. `side` accepts left, right, top and bottom.

Popovers use `popover auto`, tooltips use `popover manual`. `positionFloating`
wraps Floating UI's offset, flip, shift and autoUpdate, accepts virtual anchors,
and returns observer cleanup. It is exported for select (#34), which has not
landed yet. CSS anchor positioning is not required. Tooltips open after 500 ms,
allow moving the pointer into their content, and close with Escape or after
hover and focus leave. All tooltip timers use `options.overlays.clock` when
provided, with the same clock interface as the behavior interpreter.

Menus use arrows, Home/End, typeahead, Enter/Space, Escape and one level of
submenus with Right/Left. Disabled items cannot activate. Tabs activate on
arrow focus by default; `activation manual` waits for Enter/Space. Their
ARIA relationships derive from stable link IDs.

Radial items contain an icon and an unrotated label. Arrow keys move through
items in circular order. `presentation linear` forces the standard menu
layout; it is selected automatically when the diameter and labels cannot fit
the viewport, including at 320 px. Radius defaults to 108 px; `start-angle`
is in clockwise degrees, starting at -90 (up).

A toaster holds at most `max` visible toasts (default 3). Every toast has a
close button, announces through the shared polite status region, and never
moves focus on arrival. `politeness assertive` uses the alert region.
`duration` is milliseconds, defaulting to `--ui-toast-duration` (5000 ms).
Zero duration persists until dismissed. Hover and focus independently pause
remaining time; queued notifications begin their duration when shown.
The toaster uses a manual popover; the fallback registers in the toast layer.
Docked drawers register in the dock layer, shared with #36 windows.

## Requirements and verification plan (#35)

| Requirement                                                               | Implementation                         | Verification                                                |
| ------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Positioning and virtual pointer anchor                                    | `position.js`, `context-menu.js`       | `position.test.js`, browser context-menu tests              |
| Native modal, alert dialog, focus, inert background and window ordering   | `dialog.js`                            | browser dialog tests and opened-state axe audits            |
| Hoverable tooltip and injected delay                                      | `tooltip.js`, tooltip machine          | manual-clock unit test and browser hover/focus test         |
| Menu keyboard, submenu, target vs selection, touch triggers               | `menu.js`, `context-menu.js`           | browser keyboard and touch tests                            |
| Automatic/manual tabs, paired ARIA IDs                                    | `tabs.js`                              | unit and browser keyboard tests                             |
| Bounded queue, live announcements, paused remaining time, dismiss buttons | `toast.js`, `toast-queue.js`           | manual-clock unit tests and browser notification test       |
| Modal and docked drawers, Escape and focus return                         | `drawer.js`                            | browser drawer tests                                        |
| Radial geometry, horizontal labels/icons, keyboard, linear fallback       | `radial-geometry.js`, `radial-menu.js` | 1/3/11 and boundary unit cases, browser radial test         |
| All kinds, machines, token styles, stories and catalogue                  | `src/overlays/`, `stories/`            | machine text equality and story parse/round-trip tests      |
| Accessibility and light/dark baselines for every open surface             | `overlays.e2e.mjs`                     | `expectAccessible`, `screenshotMatrix`, Chromium and WebKit |
| Release and licensing                                                     | changeset, npm/deno lockfiles          | four required checks; Floating UI MIT package notices       |

Run focused checks with:

```sh
node --test packages/ui-components/tests/overlays/*.test.js
npx playwright test packages/ui-components/e2e/overlays.e2e.mjs --workers=1
```

The four repository gates are `npm test`, `npm run lint`,
`npm run format:check`, and `npm run check:duplication`. On memory-limited
machines, pass `-- --test-concurrency=2` to `npm test`. Full UI validation
runs on the pinned Playwright CI container.
