# @link-foundation/ui-components

Components of the associative UI framework written in Links Notation. The
first component is **diagrams**: a flowchart, state, sequence or class
diagram is a `diagram` link. [Dagre](https://github.com/dagrejs/dagre) (MIT)
lays it out and our own SVG renderer draws it. It can also be written out as
Mermaid text, or drawn by [Mermaid](https://mermaid.js.org) (MIT), which is
loaded only when a page shows a Mermaid diagram.

```lino
(login-flow: diagram
  (kind flowchart)
  (direction down)
  (start: node (label 'Start'))
  (check: node (label 'Signed in?') (shape diamond))
  (home: node (label 'Home'))
  (edge (from start) (to check))
  (edge (from check) (to home) (label 'yes')))
```

```js
import { defineDiagram } from '@link-foundation/ui-components';

defineDiagram();
const diagram = document.createElement('ui-diagram');
diagram.source = loginFlowLino; // the LiNo above
document.body.append(diagram);
```

The LiNo can also be the text content of `<ui-diagram>`.
See [`examples/diagrams.html`](examples/diagrams.html). Run
`node scripts/serve-static.mjs` from the repository root and open
`http://127.0.0.1:4173/packages/ui-components/examples/diagrams.html`.

## The diagram dialect

| Link                              | Meaning                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `(ID: diagram …)`                 | a diagram; the ID names it                                                                                   |
| `(kind K)`                        | `flowchart` (default), `state`, `sequence` or `class`                                                        |
| `(direction D)`                   | `down` (default), `up`, `right` or `left`                                                                    |
| `(label 'Text')`                  | the title of the diagram (used by screen readers)                                                            |
| `(renderer R)`                    | `svg` or `mermaid`; by default `svg` for flowcharts and states and `mermaid` for sequence and class diagrams |
| `(layout NAME)`                   | a registered layout engine (default `dagre`)                                                                 |
| `(ID: node …)`                    | a node with `(label …)`, `(shape …)` and `(group ID)`                                                        |
| `(shape S)`                       | `box` (default), `round`, `stadium`, `circle`, `diamond`, `start` or `end`                                   |
| `(edge (from A) (to B) …)`        | a connection, with an optional `(label …)`; `(ID: edge …)` names it                                          |
| `(ID: group (label …) (group P))` | a group (subgraph, composite state) inside group `P` if given                                                |

The one-line form `(f: diagram (a: node) (b: node))` and the multi-line
form give the same model. `parseDiagram` reads the first diagram of a text,
`diagramsFromLinks` every diagram of a parsed document, and `diagramToLino`
writes a model back: `diagramFromLinks(parse(diagramToLino(model)))` equals
`model`. Every error is a `DiagramError` with a `code` (`no-diagram`,
`unknown-property`, `invalid-value`, `missing-value`, `duplicate-id`,
`unknown-node`, `unknown-group`) and an `at` position: the index path of the
link and its text, since `links-notation` gives no line numbers.

## API

```js
import {
  parseDiagram, // LiNo text → DiagramModel
  diagramFromLinks, // links-notation links → DiagramModel
  diagramToLino, // DiagramModel → LiNo text
  layoutDiagram, // DiagramModel → Layout (Dagre, deterministic)
  runLayout, // the layout picked by (layout NAME)
  registerLayout, // add a layout engine
  renderDiagramSvg, // DiagramModel + Layout → SVG string
  toMermaid, // DiagramModel → Mermaid text
  defineDiagram, // <ui-diagram> and <ui-mermaid-view>
  setMermaidImporter, // where Mermaid is imported from
} from '@link-foundation/ui-components';
```

`toMermaid` of the login flow above returns, with no trailing newline:

```text
flowchart TD
  start["Start"]
  check{"Signed in?"}
  home["Home"]
  start --> check
  check -->|yes| home
```

`layoutDiagram` gives the same coordinates for the same model every time,
and no two nodes overlap. Node sizes come from the labels
(`estimateNodeSize`), or from `options.nodeSize`.

`renderDiagramSvg(model, layout, tokens)` draws flowcharts and states. The
colours are design tokens (`surface`, `onSurface`, `edge`, `group`,
`groupOutline`, `accent`, `fontFamily`, `fontSize`), which default to the
`--color-*` CSS custom properties of ui-tokens. Every label is escaped.

## Elements

`<ui-diagram>` reads its LiNo from its text content, or from its `source`
property. The `renderer` and `layout` attributes override the ones in the
LiNo. `layoutOptions` and `tokens` are properties. It sets `data-state`
(`loading`, `ready`, `error`) and `data-renderer`, and it fires a
`ui-diagram-state` event. Invalid LiNo is shown as source text with
`role="alert"`.

`<ui-mermaid-view label="…">` draws Mermaid text with Mermaid. Mermaid is
imported the first time one is shown (`import('mermaid')`, or the importer
given to `setMermaidImporter`), with `securityLevel: 'strict'`. While Mermaid
loads, and whenever loading or rendering fails, the view shows the source
text with an error message, so a diagram never just disappears.

### Accessibility

The drawing has `role="img"` and an `aria-label` that names the diagram and
counts its nodes and connections. A visually hidden list of the nodes and of
the connections ("Signed in? leads to Home: yes") follows it. The fallback
source is a focusable `pre`. axe finds no WCAG 2.2 A/AA violation on the
example page.

## Layout plugins and licences

This package depends only on MIT and Unlicense code: Dagre and
`links-notation`. Mermaid is an optional peer dependency (`^11 || ^12`).
Mermaid 11 brings in no EPL code. **Mermaid 12 depends on `elkjs`
(EPL-2.0)**, so installing Mermaid 12 is the app's choice.

Other engines, such as ELK.js (EPL-2.0) or Graphviz through
`@hpcc-js/wasm-graphviz`, can be plugged in by the app:

```js
import ELK from 'elkjs/lib/elk.bundled.js'; // EPL-2.0: the app's choice
import { registerLayout } from '@link-foundation/ui-components';

registerLayout('elk', async (model, options) => {
  // … return { width, height, nodes, edges, groups } like layoutDiagram
});
```

Diagrams that should use it write `(layout elk)`. See
`src/diagrams/layout-plugins.js` for the full ELK adapter. A test checks
that no package of this repository lists an EPL package in its
`dependencies`.
