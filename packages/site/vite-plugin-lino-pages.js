/** Vite HTML entries generated from LiNo, with the same ui-dom kinds as the client. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderToHTML, buildCss } from '@link-foundation/ui-dom';
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { loadPages } from './pages.js';
import { registerSiteKinds } from './src/kinds.js';

const packageRoot = fileURLToPath(new globalThis.URL('.', import.meta.url));
const THEME_MODULE = 'virtual:site-themes';
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function linoPages({ contentDir, layout, languages = ['en', 'ru'] }) {
  const generated = path.join(packageRoot, '.lino-pages');
  let themes;
  let resolved;
  async function generate() {
    registerSiteKinds();
    const pages = await loadPages({ contentDir, layout, languages });
    themes = new Map(
      await Promise.all(
        listThemes().map(async (id) => [id, await loadTheme(id)])
      )
    );
    const css = `${buildCss({ themeRegistry: themes })}\n${buildCss(
      {
        baseCss: false,
        styles: await readFile(
          new globalThis.URL('./src/styles.lino', import.meta.url),
          'utf8'
        ),
      },
      undefined,
      (diagnostic) => {
        throw new Error(
          `styles.lino: ${diagnostic.message ?? diagnostic.code}`
        );
      }
    )}${await readFile(
      new globalThis.URL('./src/site.css', import.meta.url),
      'utf8'
    )}`;
    const controlsCss = await readFile(
      new globalThis.URL(
        '../ui-components/src/controls/styles.css',
        import.meta.url
      ),
      'utf8'
    );
    await mkdir(generated, { recursive: true });
    await writeFile(path.join(generated, 'site.css'), `${controlsCss}\n${css}`);
    const inputs = [];
    for (const page of pages) {
      const file = path.join(generated, page.route, 'index.html');
      await mkdir(path.dirname(file), { recursive: true });
      const html = `<!doctype html><html lang="${page.language}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>${escapeHtml(page.title)}</title>
<link rel="stylesheet" href="/site.css"></head><body>
<div id="app">${renderToHTML(page.document, { themeRegistry: themes })}</div>
<script id="site-document" type="application/json">${json({ text: page.text, language: page.language, page: page.page, languages })}</script>
<script type="module" src="/site-main.js"></script></body></html>`;
      await writeFile(file, html);
      inputs.push(file);
    }
    const home = path.join(generated, 'index.html');
    await writeFile(
      home,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Links UI · Language</title></head><body><main><h1>Links UI</h1><p><a href="./en/">English</a> · <a href="./ru/">Русский</a></p></main><script>location.replace('./'+(navigator.language.toLowerCase().startsWith('ru')?'ru':'en')+'/');</script></body></html>`
    );
    return [...inputs, home];
  }
  return {
    name: 'lino-pages',
    // Vite discovers file assets through `new URL(..., import.meta.url)`.
    // ui-devmode uses the equivalent globalThis spelling for Node linting.
    transform(code, id) {
      if (
        id.endsWith('/ui-devmode/src/agent-instruction.js') ||
        id.endsWith('/ui-devmode/src/inspector.js')
      ) {
        return code.replaceAll('new globalThis.URL(', 'new URL(');
      }
    },
    async config() {
      const input = await generate();
      return {
        root: generated,
        resolve: {
          alias: { '/site-main.js': path.join(packageRoot, 'src/main.js') },
        },
        build: { rollupOptions: { input } },
      };
    },
    configResolved(config) {
      resolved = config;
    },
    resolveId(id) {
      if (id === THEME_MODULE) {
        return `\0${id}`;
      }
    },
    load(id) {
      if (id === `\0${THEME_MODULE}`) {
        const data = JSON.stringify(themes, (_key, value) =>
          value instanceof Map ? { siteMap: [...value] } : value
        );
        return `export default JSON.parse(${JSON.stringify(data)}, (_key, value) => value?.siteMap ? new Map(value.siteMap) : value);`;
      }
    },
    configureServer(server) {
      server.watcher.add([contentDir, layout, path.join(packageRoot, 'src')]);
      server.watcher.on('change', async (file) => {
        if (
          file.startsWith(contentDir) ||
          file === layout ||
          file.startsWith(path.join(packageRoot, 'src'))
        ) {
          try {
            await generate();
            server.ws.send({ type: 'full-reload' });
          } catch (error) {
            resolved.logger.error(error.message);
            server.ws.send({
              type: 'error',
              err: { message: error.message, stack: error.stack },
            });
          }
        }
      });
    },
  };
}
