# @link-foundation/ui-designer

A WYSIWYG designer whose docked shell and editable document are Links
Notation. It reuses ui-components docking and controls, ui-devmode's overlay,
outline model, policy and typed property grid, ui-store history and ui-core's
source-preserving editor. No build step is needed.

Serve the repository with `node scripts/serve-static.mjs` and open
`http://127.0.0.1:4173/packages/ui-designer/examples/index.html`.
The example opens the sample document with comments and executable actions.

```js
import { mountDesigner } from '@link-foundation/ui-designer';
import '@link-foundation/ui-components/layout';
import '@link-foundation/ui-components/layout.css';
import '@link-foundation/ui-components/controls.css';
import '@link-foundation/ui-designer/designer.css';

const designer = mountDesigner({ root, documentText });
const source = designer.getText();
designer.undo();
designer.redo();
designer.destroy();
```

`src/designer.lino` defines the Toolbox/Outline tabs, Canvas, Properties and
Source docks. `layoutText` can replace that shell while retaining its named
panels and toolbar actions. `src/layout-text.js` embeds the same document for
synchronous mounting; a test checks they match. The framework's panel menus
collapse, restore, close and move panels; separators support pointer and
keyboard resizing. `Ctrl+F6` cycles panels.

`mountDesigner` also accepts `storage` (Web Storage, or `null`), `storageKey`
(default `link-ui-designer`), `policy` (the ui-devmode policy object or LiNo),
`catalog`, `snapThreshold` (default 6 CSS pixels), `onAction` and optional
`trace(event, detail)`. Tracing is off unless supplied. Policy-disabled
mounts fail; locked elements and their descendants cannot be edited, moved
or removed through canvas, properties, clipboard or Source. No writable
policy layers means read-only editing. Run mode dispatches the canvas's
normal actions to `onAction`; Design mode intercepts clicks to select.

The result exposes `store`, `select(id)`, `setMode('design'|'run')` and
`editSource(text)` as well as `getText`, `undo`, `redo`, and `destroy`.
Each successful editing gesture is one store transaction. A preview store
validates the complete change and source patch before the real store changes.
Undo/redo restore both the document and the exact original source text.

The draft is the current document text, persisted after each transaction under
`<storageKey>.draft`; reload recreates the store from that text. Dock layout is
saved as LiNo through ui-config's `user` layer under `<storageKey>.user`.
Unavailable or full storage does not prevent editing. Open uses a file input;
Save downloads the current `.lino` text; Copy source uses the clipboard (or
selects the Source text when clipboard permission is unavailable). Fragment
copy/paste also has an internal clipboard fallback.

## Editing

| Action               | Pointer                                                                      | Keyboard                                                                            |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Select               | Click canvas or Outline                                                      | Outline arrows, Home/End, Enter/Space                                               |
| Extend selection     | Shift+click range, Ctrl/Cmd+click toggle; drag blank canvas for marquee      | Shift+Outline arrows                                                                |
| Insert               | Click toolbox or drag into canvas/Outline                                    | Enter on toolbox item inserts into selected container                               |
| Move                 | Drag canvas/Outline; edges indicate flow insertion, centre selects container | Alt+Up/Down reorders siblings; cut/paste reparents                                  |
| Delete / duplicate   | Toolbar                                                                      | Delete; Ctrl/Cmd+D                                                                  |
| Cut / copy / paste   | Toolbar                                                                      | Ctrl/Cmd+X/C/V                                                                      |
| Undo / redo          | Toolbar                                                                      | Ctrl/Cmd+Z; Ctrl/Cmd+Shift+Z                                                        |
| Move by pixels       | Drag within current container with sibling snap guides                       | Canvas arrows: 1 px; Shift+arrows: 10 px                                            |
| Resize explicit size | Drag corner handle                                                           | Focus handle; arrows: 1 px, Shift+arrows: 10 px; or edit width/height in Properties |
| Cancel gesture       | —                                                                            | Escape (pointer cancellation also discards preview)                                 |
| Save / open          | Toolbar                                                                      | Ctrl/Cmd+S/O                                                                        |

The toolbox derives types, child rules and property types from #34's control
vocabulary and the layout vocabulary. Entries have names, icons and initial
text/button defaults. `createCatalog(vocabulary)` returns a customizable Map;
`canContain(catalog, parentType, childType)` uses its `children` rule (`any`,
`none` or an array of allowed kinds). Unknown types refuse insertion. Paste
assigns fresh IDs to every node and remaps reference-typed properties inside
the fragment. Selected ancestors subsume selected descendants.

Pure APIs are exported from the package and the `/commands`, `/selection`,
`/snap` and `/sync` subpaths. Commands are `insertElement`, `moveElements`,
`removeElements`, `duplicateElements`, `setProperty`, `copyElements` and
`pasteElements`. Editing commands return affected IDs and join an existing
store transaction. Move indexes identify slots before removing the selection.

## Source and geometry

Source edits use the official links-notation parser and reconcile named IDs
and anonymous sibling identities, rather than replacing the whole store.
Parse errors return `{error: {line, column, message}}`, keep the last valid
canvas and history, and remain visible in Source. Comment-only edits are
undoable. Canvas edits use `applyOpsToSource` from ui-core/source so untouched
text, including comments and whitespace, stays byte-for-byte unchanged.
Addressed anonymous nodes receive source names derived from their stable store
IDs; other anonymous nodes remain untouched. The official formatter and source
index determine those prefixes. Clipboard fragments use the nested form.

The code editor dependency #46 is still open, so Source is the explicitly
allowed plain `textarea` fallback.

The designer's exported `designerVocabulary()` extends the layout vocabulary
with `x`/`y` (numbers in CSS pixels) and `width`/`height` (dimensions) on visual
kinds. Its canvas applies translation and explicit dimensions; these properties
are preserved in saved LiNo. Windows retain the existing numeric geometry and
native layout renderer. This is a designer vocabulary extension, recorded
in `docs/spec/open-questions.md`, pending a core geometry dialect. Flow insertion
reorders stack/grid children; free movement within a container writes x/y.

## Verification

```sh
node --test packages/ui-designer/tests/*.test.js
npx playwright test packages/ui-designer/tests/e2e --workers 1
npm test
npm run lint
npm run format:check
npm run check:duplication
```

Browser scenarios cover the four milestones, pointer cancellation, refusal,
transaction history, keyboard paths, file/clipboard operations and axe WCAG
2.2 AA in both light and dark modes. They attach milestone screenshots.
All runtime dependencies are existing permissively licensed framework packages;
the designer adds no third-party runtime library or asset.
