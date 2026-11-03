import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
// The same helper as `import { isUiCustomElement } from
// '@link-foundation/ui-vue'`, read from the workspace source.
import { isUiCustomElement } from '../../packages/ui-vue/src/custom-elements.js';

const packages = fileURLToPath(new URL('../../packages/', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [
    vue({
      template: {
        // `ui-*` tags are ui-dom custom elements, not Vue components.
        compilerOptions: { isCustomElement: isUiCustomElement },
      },
    }),
  ],
  resolve: {
    // The workspace packages are used from their src/ folders, as the
    // published packages would be from node_modules.
    alias: [
      {
        find: '@link-foundation/ui-tokens/themes',
        replacement: `${packages}ui-tokens/src/themes/index.js`,
      },
      {
        find: /^@link-foundation\/(ui-[a-z]+)$/,
        replacement: `${packages}$1/src/index.js`,
      },
      {
        find: /^@link-foundation\/(ui-[a-z]+)\/([a-z-]+)$/,
        replacement: `${packages}$1/src/$2.js`,
      },
    ],
    // Their dependencies are installed here: one Vue, one parser.
    dedupe: ['vue', 'links-notation'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // The optional peer of ui-store's doublets storage, which this app
      // does not open: a runtime import, never bundled.
      external: ['doublets-web'],
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
