import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packages = fileURLToPath(new URL('../../packages/', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // The ui-* packages are imported from packages/*/src, outside this app;
    // their third-party dependencies are installed here, so resolve them
    // from the app root.
    alias: [
      {
        find: '@link-foundation/ui-react/hooks',
        replacement: `${packages}ui-react/src/hooks.js`,
      },
      {
        find: '@link-foundation/ui-dom/html',
        replacement: `${packages}ui-dom/src/html.js`,
      },
      {
        find: /^@link-foundation\/(ui-[a-z]+)$/,
        replacement: `${packages}$1/src/index.js`,
      },
    ],
    dedupe: ['links-notation', 'react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // ui-store loads its optional peer doublets-web (WebAssembly) with a
      // lazy import() that this app never calls.
      external: ['doublets-web'],
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
