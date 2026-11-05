import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { prepareUpstream } from './upstream.mjs';

const dependencies = resolve(
  process.env.DEEPCASE_NODE_MODULES ?? 'examples/deepcase/node_modules'
);
const upstream = await prepareUpstream();
const result = await build({
  metafile: true,
  entryPoints: ['examples/deepcase/main.js'],
  outfile: 'examples/deepcase/dist/main.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  nodePaths: [upstream, dependencies],
  alias: {
    react: `${dependencies}/react`,
    'react-dom': `${dependencies}/react-dom`,
    fs: resolve('examples/deepcase/browser-filesystem.js'),
    'next/dynamic': resolve('examples/deepcase/browser-dynamic.js'),
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    global: 'globalThis',
  },
  loader: { '.wasm': 'file' },
  logLevel: 'warning',
  plugins: [
    {
      name: 'upstream-browser-boundaries',
      setup(builder) {
        builder.onResolve(
          { filter: /client-handler$/ },
          ({ importer, path }) => {
            if (
              importer.includes('@deep-foundation/deepcase') &&
              path.endsWith('/client-handler')
            ) {
              return { path: resolve('examples/deepcase/browser-handlers.js') };
            }
          }
        );
        builder.onLoad(
          { filter: /@deep-foundation\/deepcase\/imports\/cyto\/graph\.js$/ },
          async ({ path }) => ({
            contents: (await readFile(path, 'utf8'))
              .replace(
                "import edgeConnections from 'cytoscape-edge-connections';",
                ''
              )
              .replace('cytoscape.use(edgeConnections);', ''),
            loader: 'js',
          })
        );
      },
    },
  ],
});
await writeFile(
  'examples/deepcase/dist/metafile.json',
  JSON.stringify(result.metafile)
);
