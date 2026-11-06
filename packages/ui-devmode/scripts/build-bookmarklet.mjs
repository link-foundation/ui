import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new globalThis.URL('..', import.meta.url));
const bundleUrl = new globalThis.URL(
  process.env.UI_DEVMODE_BUNDLE_URL ??
    'https://link-foundation.github.io/ui/devmode/foreign.js'
);
if (!['http:', 'https:'].includes(bundleUrl.protocol)) {
  throw new Error('Bundle URL must use HTTP(S)');
}
// Inline the template: an injected bundle cannot fetch assets through the page CSP.
const plugins = [
  {
    name: 'browser-store-entry',
    // The inspector needs the in-memory store, never the optional WASM backend.
    enforce: 'pre',
    resolveId(id) {
      if (id === '@link-foundation/ui-store') {
        return '\0foreign-browser-store';
      }
    },
    load(id) {
      if (id === '\0foreign-browser-store') {
        return `export { createStore } from ${JSON.stringify(`${root}/../ui-store/src/store.js`)}; export { GENERATED_ID_PREFIX } from ${JSON.stringify(`${root}/../ui-store/src/ids.js`)};`;
      }
    },
  },
  {
    name: 'inline-agent-template',
    transform(code, id) {
      if (id.endsWith('/agent-instruction.js')) {
        const transformed = code
          .replace(
            /export async function loadAgentTemplate\(\) \{[\s\S]*?\n\}/,
            'export async function loadAgentTemplate() { return await Promise.resolve(template); }'
          )
          .replace('const template = await loadAgentTemplate();', '');
        return `import template from './agent-instruction.txt?raw';\n${transformed}`;
      }
      if (id.endsWith('/inspector.js')) {
        const transformed = code.replace(
          /export async function loadLayout\(\) \{[\s\S]*?\n\}/,
          'export async function loadLayout() { return await Promise.resolve(foreignLayout); }'
        );
        return `import foreignLayout from './inspector.lino?raw';\n${transformed}`;
      }
    },
  },
];
for (const [format, fileName, emptyOutDir] of [
  ['es', 'foreign.js', false],
  ['iife', 'devmode.js', false],
]) {
  await build({
    root,
    configFile: false,
    plugins,
    build: {
      emptyOutDir,
      target: 'es2022',
      minify: true,
      lib: {
        entry: `${root}/src/foreign/injected.js`,
        formats: [format],
        name: 'LinkUiForeign',
        fileName: () => fileName,
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}
// Base64 keeps the configurable address out of JavaScript source syntax.
const address = Buffer.from(bundleUrl.href, 'utf8').toString('base64');
const loader = `javascript:(()=>{const s=document.createElement('script');s.type='module';s.src=atob('${address}')+'?load='+Date.now();s.onload=()=>s.remove();s.onerror=()=>{s.remove();alert('Dev mode could not load. A strict CSP may block bookmarklets; use the Links UI extension.');};document.documentElement.append(s)})()`;
await writeFile(`${root}/dist/bookmarklet.txt`, `${loader}\n`);
