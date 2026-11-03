/** Generate real eject files, then serve them through Vite. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { exportDocument } from '../../packages/ui-convert/src/index.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const source = readFileSync(
  new URL(
    '../../packages/ui-convert/tests/export/fixtures/document.lino',
    import.meta.url
  ),
  'utf8'
);
const generated = join(root, 'dist');
mkdirSync(generated, { recursive: true });
for (const target of ['react', 'vue']) {
  const result = await exportDocument(source, {
    target,
    mode: 'eject',
    componentName: target === 'react' ? 'ReactExample' : 'VueExample',
  });
  for (const file of result.files) {
    writeFileSync(join(generated, file.path), file.contents);
  }
}
const server = await createServer({
  configFile: false,
  root,
  plugins: [vue()],
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
});
await server.listen();
server.printUrls();
