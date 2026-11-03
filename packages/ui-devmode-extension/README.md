# Links UI dev mode extension

Private workspace: not published to npm or a browser store. Run:

```bash
npm run build --workspace @link-foundation/ui-devmode-extension
```

The script builds the shared dev mode bundle, writes
`dist/unpacked/{manifest.json,background.js,devmode.js}` and
`dist/ui-devmode-extension.zip`. In Chromium, open `chrome://extensions`, enable
Developer mode, click Load unpacked and choose `dist/unpacked`.

Visit a regular HTML page and click the toolbar action (pin it if necessary).
Select a title, open Properties, edit text and style color. Reload the page and
click the action again: both changes return. The action toggles an open inspector.
Copy overrides as LiNo and Copy subtree as LiNo provide the migration artifacts.
Changes are saved in `chrome.storage.local`, isolated by origin and pathname.
The action grants `activeTab`; `scripting` injects the packaged `devmode.js` in
an isolated world. `storage` saves the LiNo. No broad host permissions are used.

Unlike the bookmarklet, extension script injection works under page script CSP,
including `packages/ui-devmode/tests/fixtures/foreign-csp.html`. Internal browser
pages, extension store pages, and other restricted targets are unsupported.
Cross-origin iframe content and closed shadow roots are not traversed.

The automated `foreign.e2e.mjs` test loads this unpacked folder in a persistent
Chromium context, activates the actual action handler through its service worker,
and verifies edits, storage, reload and strict CSP. This uses a test-only host
grant to simulate the activeTab grant Chrome supplies on a real toolbar click.
To verify manually, serve the repository, open the CSP fixture, click the toolbar
action, edit the first title and reload/reopen. See PR #151 for the screenshot.
