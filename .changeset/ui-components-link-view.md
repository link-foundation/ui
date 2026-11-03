---
'@link-foundation/ui-components': minor
---

Add `@link-foundation/ui-components` with `link-view`, a single link visualisation ported from links-visuals:

- link geometry: nine points through a Catmull-Rom path, self-loops and free ends;
- `bar`, `arrow`, `cross`, `dot` and `none` markers, kept as data and shared by the SVG and Canvas renderers;
- `createZoomPan` (0.1 to 20, `0.999 ** delta`, pointer capture), separate for each element;
- an animator that asks for no frame while idle and respects reduced motion;
- a `link-view` custom element that reads Links Notation through the official parser, with `blueprint` and `grid` modes, `+`, `-` and `0` keys, and an accessible name;
- a gallery page.
