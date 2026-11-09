# Responsive frames

Run `node examples/themes/responsive-frames/build.mjs` from the repository root,
then serve the repository with `node scripts/serve-static.mjs --port 4173` and
open `/examples/themes/responsive-frames/dist/index.html`.

The build reads [frames.lino](frames.lino) with the official parser and writes
static HTML and CSS into the ignored `dist` directory. The page contains no
runtime JavaScript. Each pair compares the previous fixed-size SVG output after
a resize with the responsive CSS output at 320×200, 80×24 and 1200×40.

The comparison intentionally keeps the old geometry at 320×200 to reproduce the
resize failure; regenerating it at each size requires host JavaScript. The new
stylesheet follows layout changes automatically. See [the frame specification](../../../docs/spec/frames.md)
for live controls, nesting, states and the optional threshold helper.
