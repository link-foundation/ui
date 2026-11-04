import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { linoPages } from './vite-plugin-lino-pages.js';

const root = fileURLToPath(new globalThis.URL('.', import.meta.url));
const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
export default defineConfig({
  base:
    process.env.GITHUB_PAGES === 'true' && repository
      ? `/${repository}/`
      : './',
  plugins: [
    linoPages({
      contentDir: `${root}content`,
      layout: `${root}layout.lino`,
      languages: ['en', 'ru'],
    }),
  ],
  build: {
    outDir: `${root}dist`,
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      external: (id) =>
        id === 'doublets-web' ||
        id === 'lino-i18n/loaders' ||
        id.startsWith('node:'),
    },
  },
  server: {
    fs: {
      allow: [fileURLToPath(new globalThis.URL('../../', import.meta.url))],
    },
  },
});
