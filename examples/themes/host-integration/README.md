# Host artwork and frame surfaces

Run `node scripts/serve-static.mjs` from the repository root and open
`http://127.0.0.1:4173/examples/themes/host-integration/`.

The two star canvases use the same host generator, layout and sprites. The left
canvas draws them directly and the right canvas uses the starfield module. The
scene fixes a saved shader clock and coordinates three independently mounted
layers using one grid phase. The card and nested frame use CSS declarations
from the LiNo skin on host pseudo-elements. Toggle **Reduce transparency** to
see the filter and texture give way to an opaque surface with the same contour.

The artwork and settings in this example are original. Browser coverage lives
in `tests/ui/host-integration.e2e.mjs`.
