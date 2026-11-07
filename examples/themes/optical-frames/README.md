# Optical frames

Build only this example:

```sh
npx esbuild examples/themes/optical-frames/example.js --bundle --format=esm --outfile=examples/themes/optical-frames/dist/example.js
node scripts/serve-static.mjs --port 4173
```

Open <http://127.0.0.1:4173/examples/themes/optical-frames/index.html>.
Append `?before` to compare the existing shared-corner helper with the independent
pixel-frame composition. This is an original framework example, not a screenshot
or pixel comparison of konard.github.io. Noise and refraction properties are
exposed for host hooks; no shader is installed by this example.

The automated browser test also builds this small bundle, audits accessibility,
checks the layer structure and compares a reviewed screenshot.
