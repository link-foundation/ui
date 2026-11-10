import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';
import { getKind } from '@link-foundation/ui-dom';
import { readDocument } from '../pages.js';

const site = fileURLToPath(new globalThis.URL('../', import.meta.url));
const vite = path.join(
  path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  'bin/vite.js'
);

test(
  'Vite emits all pre-rendered entries and deployable assets for /ui/',
  { timeout: 60_000 },
  async (t) => {
    const output = await mkdtemp(path.join(tmpdir(), 'ui-site-build-'));
    const environment = process.env.NODE_ENV;
    const button = getKind('button');
    try {
      // Vite changes NODE_ENV and the site registers kinds. Keep both out of
      // Bun/Deno's shared test process so other renderer tests retain defaults.
      const started = Date.now();
      const build = promisify(execFile)(
        'node',
        [
          vite,
          'build',
          '--config',
          path.join(site, 'vite.config.js'),
          '--base',
          '/ui/',
          '--outDir',
          output,
          '--logLevel',
          'silent',
        ],
        {
          cwd: site,
          env: { ...process.env, NODE_ENV: 'production' },
          signal: t.signal,
        }
      );
      const trace = (event) => {
        if (process.env.SITE_BUILD_TRACE === '1') {
          console.error(
            `[site-build] child ${event}: ${Date.now() - started}ms`
          );
        }
      };
      build.child.on('exit', () => trace('exit'));
      build.child.on('close', () => trace('close'));
      const closed = new Promise((resolve) =>
        build.child.once('close', resolve)
      );
      try {
        const { stderr } = await build;
        if (process.env.SITE_BUILD_TRACE === '1') {
          console.error(stderr);
        }
      } finally {
        // execFile rejects on abort before the child has actually exited.
        // Reap it before removing the output directory, including on timeout.
        await closed;
      }
      assert.equal(process.env.NODE_ENV, environment);
      assert.equal(getKind('button'), button);
      for (const language of ['en', 'ru']) {
        for (const page of [
          '',
          'getting-started/',
          'dialect/',
          'components/',
          'playground/',
          'themes/',
          'about/',
        ]) {
          const html = await readFile(
            path.join(output, language, page, 'index.html'),
            'utf8'
          );
          const document = new JSDOM(html).window.document;
          assert.equal(document.documentElement.lang, language);
          assert.ok(document.querySelector('main h1')?.textContent.length > 5);
          assert.ok(document.querySelector('main [data-link-id]'));
          assert.ok(!document.querySelector('ui-unknown'));
          if (page === 'components/') {
            assert.equal(
              document.querySelectorAll('[data-component]').length,
              21
            );
            const frame = document.querySelector('#component-gallery iframe');
            const matrixPath = path.resolve(
              path.dirname(path.join(output, language, page, 'index.html')),
              frame.getAttribute('data-src')
            );
            const matrix = new JSDOM(await readFile(matrixPath, 'utf8')).window
              .document;
            assert.ok(matrix.querySelector('button'));
            assert.ok(!matrix.querySelector('ui-unknown'));
            matrix.defaultView.close();
          }
          document.defaultView.close();
          for (const script of document.querySelectorAll('script[src]')) {
            const src = script.getAttribute('src');
            assert.ok(src.startsWith('/ui/assets/'), src);
            await readFile(path.join(output, src.slice('/ui/'.length)));
          }
        }
      }
      const home = new JSDOM(
        await readFile(path.join(output, 'index.html'), 'utf8')
      ).window.document;
      assert.deepEqual(
        [...home.querySelectorAll('a')].map((a) => a.getAttribute('href')),
        ['./en/', './ru/']
      );
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  }
);

test('malformed LiNo fails with filename, line and column', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ui-site-parse-'));
  const file = path.join(directory, 'broken.lino');
  try {
    await writeFile(file, 'page: document\n  (title broken');
    await assert.rejects(readDocument(file), (error) =>
      error.message.includes(`${file}:2:`)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
