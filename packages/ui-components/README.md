# @link-foundation/ui-components

Components of the associative UI framework, written in Links Notation.

## `link-view`: one link

`link-view` draws a single link. The geometry, markers and colours follow
[links-visuals](https://github.com/link-foundation/links-visuals) (Unlicense).
The element reads its model from Links Notation through the official parser
(`@link-foundation/ui-core` over `links-notation`) and draws it as SVG (the
default) or on a canvas. Each element has its own zoom and pan, and asks for
no animation frame while nothing moves.

```html
<link-view
  lino="(simple: link-view (link (id 1) (source 1) (target 2)) (markers (source bar) (target arrow)))"
></link-view>

<script type="module">
  import { defineLinkView } from '@link-foundation/ui-components';
  defineLinkView(window);
</script>
```

The model, as LiNo:

```lino
(simple: link-view
  (link (id 1) (source 1) (target 2))
  (markers (source bar) (target arrow))
  (blueprint true)
  (grid true))
```

- **Ends.** A `source` or `target` that is missing or `0` is a free end, drawn
  with a `cross` unless a marker is given. A link whose source and target are
  the same reference is a self-loop.
- **Markers.** `bar`, `arrow`, `cross`, `dot` and `none`. They are data in
  `markers.js` (`MARKERS`), which the SVG renderer (`svgMarkerDefs`) and the
  Canvas renderer (`drawMarker`, `Path2D`) both draw from.
- **Blueprint.** `(blueprint true)` shows the nine construction points: start
  green, end red, centre black (the line colour in dark mode), the others
  blue, with a dashed guide. `(grid true)` draws the grid behind the link.
- **Attributes.** `renderer` (`svg` or `canvas`), `theme` (`light` or
  `dark`; by default it follows `prefers-color-scheme`), `blueprint`, `grid`,
  `bend` and `label` override the LiNo model.
- **Accessibility.** The element has `role="img"` and is focusable. Its name
  comes from the model, for example "Link 1 from 1 to 2", "Link 2 from 3 to
  3, a self-loop" or "Link 3 from 1 to a free end".
- **Keyboard.** `+` and `-` zoom, `0` resets, and the arrow keys pan.
- **Pointer.** The wheel zooms around the pointer by `0.999 ** delta`. A drag
  pans, with pointer capture, and two fingers pinch. The zoom stays between
  0.1 and 20.
- **Colours.** The colours are ui-tokens design tokens (`color.link.*`, with
  a `dark` mode, in `LINK_TOKENS`). A page can override them with the
  `--color-link-*` CSS custom properties.

In a ui-dom document, `registerLinkViewKind(window)` renders a `link-view`
element of the document as this element.

## Building blocks

All of these are pure functions, or objects you create, with no
module-level state:

| Module             | Exports                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `geometry.js`      | `linkGeometry`, `pointAtLength`, `endAngles`, `catmullRomToCubics`, `pathToSvgD` … |
| `markers.js`       | `MARKERS`, `getMarker`, `svgMarkerDefs`, `drawMarker`                              |
| `render-svg.js`    | `renderLinkSvg(geometry, style)`: a deterministic SVG string                       |
| `render-canvas.js` | `drawLinkCanvas(ctx, geometry, style)`                                             |
| `zoom-pan.js`      | `createZoomPan(element, {min, max, onChange})`, which `destroy()` undoes           |
| `animator.js`      | `createAnimator({now, raf, caf, reducedMotion})`                                   |
| `model.js`         | `parseLinkView(text)`, `readLinkView(raw)`, `accessibleName(model)`                |
| `link-view.js`     | `defineLinkView(window)`, `registerLinkViewKind(window)`                           |

```js
import {
  linkGeometry,
  linkColors,
  renderLinkSvg,
} from '@link-foundation/ui-components';

const geometry = linkGeometry({
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
});
const svg = renderLinkSvg(geometry, {
  width: 320,
  height: 200,
  colors: linkColors(),
  ends: { source: 'bar', target: 'arrow' },
});
```

The gallery `examples/link-view.html` shows four cases: simple, self-loop,
free end and blueprint. Serve the repository with
`node scripts/serve-static.mjs` and open
`/packages/ui-components/examples/link-view.html`. It loads every module from
the repository, never from a CDN.

## Tests

```bash
node --test packages/ui-components/tests/links-view/*.test.js
npx playwright test packages/ui-components/tests/e2e/link-view.spec.js
```
