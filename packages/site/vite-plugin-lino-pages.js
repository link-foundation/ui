/** Vite HTML entries generated from LiNo, with the same ui-dom kinds as the client. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderToHTML, buildCss } from '@link-foundation/ui-dom';
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { loadPages } from './pages.js';
import { loadCatalog } from './src/gallery/catalog.js';
import { renderGallery, renderMatrix } from './src/gallery/render.js';
import { registerSiteKinds } from './src/kinds.js';
import { createBuildTrace } from './build-trace.js';

const packageRoot = fileURLToPath(new globalThis.URL('.', import.meta.url));
const THEME_MODULE = 'virtual:site-themes';
const EXAMPLES_MODULE = 'virtual:site-examples';
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function linoPages({ contentDir, layout, languages = ['en', 'ru'] }) {
  const generated = path.join(packageRoot, '.lino-pages');
  let themes;
  let catalog;
  let resolved;
  const trace = createBuildTrace();
  async function generate() {
    trace.start('generate pages');
    registerSiteKinds();
    const pages = await loadPages({ contentDir, layout, languages });
    themes = new Map(
      await Promise.all(
        listThemes().map(async (id) => [id, await loadTheme(id)])
      )
    );
    catalog = await loadCatalog();
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
    await mkdir(generated, { recursive: true });
    await writeFile(
      path.join(generated, 'site.css'),
      `${await componentCss()}\n${css}`
    );
    const inputs = [];
    for (const page of pages) {
      const file = path.join(generated, page.route, 'index.html');
      await mkdir(path.dirname(file), { recursive: true });
      let body = renderToHTML(page.document, { themeRegistry: themes });
      if (page.page === 'components') {
        body = body.replace(
          '</main>',
          `<div id="gallery-${page.language}"></div></main>`
        );
      }
      const html = `<!doctype html><html lang="${page.language}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>${escapeHtml(page.title)}</title>
<link rel="stylesheet" href="/site.css"></head><body>
<div id="app">${body}</div>
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
    trace.end('generate pages');
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
      // Time before this hook is Node start-up, Vite import and config load.
      trace.mark('vite config');
      const input = await generate();
      return {
        root: generated,
        resolve: {
          alias: { '/site-main.js': path.join(packageRoot, 'src/main.js') },
        },
        build: { rollupOptions: { input } },
      };
    },
    ...traceHooks(trace),
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        emitGallery(this, bundle, { catalog, themes, languages, trace });
      },
    },
    transformIndexHtml(html) {
      return galleryHtml(
        html,
        catalog,
        themes,
        languages,
        resolved.command === 'serve'
      );
    },
    configResolved(config) {
      resolved = config;
    },
    resolveId(id) {
      if (id === THEME_MODULE || id === EXAMPLES_MODULE) {
        return `\0${id}`;
      }
    },
    load(id) {
      if (id === `\0${EXAMPLES_MODULE}`) {
        return `export default ${JSON.stringify(catalog)};`;
      }
      if (id === `\0${THEME_MODULE}`) {
        const data = JSON.stringify(themes, (_key, value) =>
          value instanceof Map ? { siteMap: [...value] } : value
        );
        return `export default JSON.parse(${JSON.stringify(data)}, (_key, value) => value?.siteMap ? new Map(value.siteMap) : value);`;
      }
    },
    configureServer(server) {
      serveMatrices(server, catalog, themes, languages);
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

/** Rollup phase boundaries for `SITE_BUILD_TRACE=1`; no output otherwise. */
function traceHooks(trace) {
  return {
    buildStart() {
      trace.start('bundle modules');
    },
    buildEnd() {
      trace.end('bundle modules');
      trace.start('render chunks');
    },
    closeBundle() {
      trace.end('write files');
      trace.mark('build closed');
    },
  };
}

function emitGallery(plugin, bundle, { catalog, themes, languages, trace }) {
  trace.end('render chunks');
  trace.start('append gallery');
  appendGallery(bundle, catalog, themes, languages);
  trace.end('append gallery');
  trace.start('render matrices');
  emitMatrices(plugin, bundle, catalog, themes, languages);
  trace.end('render matrices');
  trace.start('write files');
}

function appendGallery(bundle, catalog, themes, languages) {
  // Append pre-rendered examples after Vite has parsed the small page shell.
  // Feeding thousands of static controls through its HTML AST wastes memory.
  for (const asset of Object.values(bundle)) {
    if (asset.type === 'asset' && asset.fileName.endsWith('.html')) {
      for (const language of languages) {
        const marker = `<div id="gallery-${language}"></div>`;
        if (String(asset.source).includes(marker)) {
          asset.source = String(asset.source).replace(
            marker,
            renderGallery(catalog, language)
          );
        }
      }
    }
  }
}
async function componentCss() {
  const files = ['controls/styles.css', 'layout/layout.css'];
  const sheets = await Promise.all(
    files.map((file) =>
      readFile(
        new globalThis.URL(`../ui-components/src/${file}`, import.meta.url),
        'utf8'
      )
    )
  );
  return sheets.join('\n');
}
function galleryHtml(html, catalog, themes, languages, serve) {
  if (serve) {
    for (const language of languages) {
      const marker = `<div id="gallery-${language}"></div>`;
      if (html.includes(marker)) {
        html = html.replace(marker, renderGallery(catalog, language));
      }
    }
  }
  return html;
}

function emitMatrices(plugin, bundle, catalog, themes, languages) {
  const stylesheet = Object.values(bundle).find((asset) =>
    asset.fileName.endsWith('.css')
  )?.fileName;
  for (const language of languages) {
    for (const example of catalog.flatMap((c) => c.examples)) {
      plugin.emitFile({
        type: 'asset',
        fileName: `gallery/${language}/${example.id}.html`,
        source: renderMatrix(example, themes, language, `../../${stylesheet}`),
      });
    }
  }
}

function serveMatrices(server, catalog, themes, languages) {
  server.middlewares.use((request, response, next) => {
    const parts = request.url.split('?')[0].split('/');
    const at = parts.indexOf('gallery');
    const language = parts[at + 1];
    const example = catalog
      .flatMap((c) => c.examples)
      .find((e) => `${e.id}.html` === parts[at + 2]);
    if (at < 0 || !languages.includes(language) || !example) {
      return next();
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(renderMatrix(example, themes, language, '/site.css'));
  });
}
