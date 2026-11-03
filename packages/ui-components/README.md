# @link-foundation/ui-components

The components of the associative UI framework, written in Links Notation
and rendered by [`@link-foundation/ui-dom`](../ui-dom/README.md). The first
group is **layout and windowing**: `stack`, `grid`, `split`, `tab-group`,
`dock`, `window` and `app-shell`. A layer manager orders every floating
surface, and a dock layout can be saved and read back as Links Notation.

```js
import { mountDocument } from '@link-foundation/ui-dom';
import {
  createLayerManager,
  layoutVocabulary,
} from '@link-foundation/ui-components';

mountDocument(app, text, {
  parseOptions: { vocabulary: layoutVocabulary() },
  layout: { storage: window.localStorage, layers: createLayerManager() },
});
```

```html
<link rel="stylesheet" href="@link-foundation/ui-components/layout.css" />
```

Importing the package registers the layout kinds with ui-dom. The CSS gives
them their layout (dividers, tab strips, window frames, dock regions, shell
modes); every colour and size is a design token or a `--ui-*` custom
property with a fallback.

The gallery `examples/layout.html` (served with
`node scripts/serve-static.mjs`) shows every kind; its Playwright spec is
`tests/e2e/layout.spec.js`.

## Layout kinds

| Kind        | Example                                                                                        | What it does                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack`     | `(stack (direction row) (gap 8px) (align center) (justify space-between) (wrap true) ...)`     | CSS flexbox. `direction` takes `vertical`, `horizontal`, `row`, `column` and their `-reverse` forms.                                                                                          |
| `grid`      | `(grid (columns 16rem 1fr) (rows auto 1fr) (areas 'nav main') ...)`                            | CSS grid. Tracks are lengths, `fr`, `auto`, `(repeat N ...)`, `(minmax MIN MAX)` and `(fit-content L)`; every token is checked. A child whose id names an area goes into it.                  |
| `split`     | `(split (sizes 30 70) (min 20) (collapsible true false) (remember-size chat.split) ...)`       | Panes with dividers (WAI-ARIA window splitter). Sizes are percentages with a constant total. `remember-size` keeps `(sizes 30 70)` in the render storage.                                     |
| `tab-group` | `(tab-group (label Inspector) (active styles) (styles: panel (title Styles) ...) ...)`         | Panels behind a tab strip (WAI-ARIA tabs, automatic activation). Tabs can be closed, reordered and dragged; a "More tabs" menu appears when they overflow.                                    |
| `panel`     | `(panel (title Styles) (closable true) ...)`                                                   | A titled panel: a tab of a tab group or a dock panel.                                                                                                                                         |
| `dock`      | `(dock (persist designer.layout) (left: region (size 16rem) (panels toolbox outline)) ...)`    | Panels docked left, right, top, bottom and center; each region shows its panels as tabs. A panel can move to another region, float, close and come back; the layout is saved under `persist`. |
| `window`    | `(window (title Inspector) (open false) (x 120) (y 96) (width 360) (height 280) ...)`          | A floating, movable, resizable non-modal dialog. It stays inside the viewport and is raised by the layer manager.                                                                             |
| `app-shell` | `(app-shell (breakpoints 640 1024) (bottom-bar tabs) (rail rail-nav) (drawer drawer-nav) ...)` | A bottom bar up to the first breakpoint, a rail up to the second one and a drawer from it on. The shell fills the viewport, its content scrolls, and it writes its `mode` attribute.          |

Parse layout documents with `{ vocabulary: layoutVocabulary() }` so their
properties are checked; `LAYOUT_VOCABULARY_TEXT` is the same vocabulary as
Links Notation.

## Keyboard

| Element   | Keys                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divider   | Arrows move by 1 (Shift: 10). Home gives the smallest size (collapses a collapsible pane), End the largest. Enter collapses or restores the pane. |
| Tab strip | Left and Right select, Home and End go to the ends, Delete closes a closable tab, Ctrl+Shift+Left and Right reorder.                              |
| Window    | Alt+Arrow moves by 16px, Alt+Shift+Arrow resizes, Escape closes and gives the focus back to the opener.                                           |
| Dock      | The "Panel actions" menu (⋮) moves, floats, closes or collapses the shown panel. Ctrl+F6 and Ctrl+Shift+F6 go to the next and previous panel.     |

## Events

The elements change themselves and tell the application, which may write the
change back to its store: `split-resize` (`detail.sizes`), `tab-change`
(`detail.active`), `tab-close` (`detail.panel`), `tab-reorder`
(`detail.order`), `window-change` (`detail.rect`), `window-close`
(`detail.id`), `dock-change` (`detail.layout`, `detail.lino`) and
`shell-mode` (`detail.mode`).

## Render options

`mountDocument(..., { layout: { storage, layers } })`:

- `storage`: an object with `getItem` and `setItem` (such as
  `localStorage`). Splits with `remember-size` and docks with `persist` use
  it.
- `layers`: a layer manager (`createLayerManager()`); by default one is
  shared by the document.

## Pure models

The models have no DOM and return new values.

### Layer manager

```js
import { createLayerManager, LAYERS } from '@link-foundation/ui-components';

const layers = createLayerManager();
layers.register('confirm', 'modal');
layers.register('inspector', 'window');
layers.raise('inspector');
layers.zIndexOf('confirm') > layers.zIndexOf('inspector'); // true
```

The layers have a fixed order (`LAYERS`: `base`, `dock`, `window`,
`popover`, `modal`, `toast`). Raising a surface moves it only within its
layer, so a raised window never covers a modal.

### Split sizes

```js
import { resizeSplit, collapsePane } from '@link-foundation/ui-components';

resizeSplit([30, 70], 0, 60, { min: 20, max: 75 }); // [75, 25]
collapsePane([30, 70], 0, { min: 20, collapsible: true }); // [0, 100]
```

`resizeSplit`, `collapsePane`, `restorePane` and `normalizeSizes` keep the
total and every pane within its `min` and `max` (a collapsed pane is 0).

### Dock layout

```js
import {
  dockLayoutFromLinks,
  dockLayoutToLino,
  movePanel,
} from '@link-foundation/ui-components';

const layout = dockLayoutFromLinks(`(designer: dock
  (persist designer.layout)
  (left: region (size 16rem) (panels toolbox outline))
  (right: region (size 20rem) (panels properties))
  (center: region (panels canvas)))`);
dockLayoutToLino(movePanel(layout, 'outline', 'right'));
// (designer: dock
//   (persist designer.layout)
//   (left: region (size 16rem) (panels toolbox))
//   (right: region (size 20rem) (panels properties outline))
//   (center: region (panels canvas)))
```

`movePanel`, `floatPanel`, `closePanel`, `restorePanel`, `activatePanel` and
`updateRegion` change a layout. Floating and closed panels are written as
`(float PANEL (x ...) (y ...) (width ...) (height ...) (region SIDE))` and
`(closed PANEL SIDE)`. Reading the written text gives the same layout back.

## License

[Unlicense](LICENSE)
