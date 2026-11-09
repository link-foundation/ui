# Sound settings and plain document controls

From the repository root:

```sh
npx esbuild packages/ui-sound/examples/main.js --bundle --format=esm --outfile=packages/ui-sound/examples/dist/main.js
node scripts/serve-static.mjs --port 4173
```

Open <http://127.0.0.1:4173/packages/ui-sound/examples/index.html>.
Sound starts off. Enable it, choose a voice under Activate, and use the
interaction or preview buttons. The schema uses the theme voice character
labels, four progressive slots and the standard settings panel preview hook.
Generated preferences bind to the config user layer; hosts can persist that
layer with `persistUserLayer`. The document binder handles plain HTML controls.
