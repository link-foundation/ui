import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repo = fileURLToPath(new globalThis.URL('../../', import.meta.url));
const require = createRequire(
  path.join(repo, 'packages/ui-devmode/package.json')
);
const { build, preview } = await import(require.resolve('vite'));

/** Build real npm tarballs outside the workspace, without consumer aliases or transforms. */
export async function buildConsumer({ inline = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'ui-vite-consumer-'));
  const modules = path.join(root, 'node_modules');
  await mkdir(path.join(modules, '@link-foundation'), { recursive: true });
  const packed = new Set();
  async function pack(name) {
    if (packed.has(name)) {
      return;
    }
    packed.add(name);
    const dir = path.join(
      repo,
      'packages',
      name.replace('@link-foundation/', '')
    );
    const manifest = JSON.parse(
      await readFile(path.join(dir, 'package.json'), 'utf8')
    );
    const result = JSON.parse(
      execFileSync(
        'npm',
        ['pack', dir, '--ignore-scripts', '--json', '--pack-destination', root],
        { encoding: 'utf8' }
      )
    );
    const target = path.join(modules, name);
    await mkdir(target, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      path.join(root, result[0].filename),
      '--strip-components=1',
      '-C',
      target,
    ]);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (dependency.startsWith('@link-foundation/ui-')) {
        await pack(dependency);
      }
    }
  }
  await pack('@link-foundation/ui-devmode');
  await pack('@link-foundation/ui-i18n');
  // Reuse installed third-party dependencies; every UI package is unpacked, never linked.
  for (const name of await readdir(path.join(repo, 'node_modules'))) {
    if (
      name === '@link-foundation' ||
      name === 'doublets-web' ||
      name.startsWith('.')
    ) {
      continue;
    }
    await symlink(
      path.join(repo, 'node_modules', name),
      path.join(modules, name),
      'junction'
    );
  }
  await writeFile(
    path.join(root, 'package.json'),
    '{"type":"module","private":true}'
  );
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><html lang="en"><title>External Vite consumer</title><body><main><h1 id="title">External application</h1><button id="open">Open inspector</button><p id="status" role="status">Ready</p></main><script type="module" src="/main.js"></script></body></html>'
  );
  await writeFile(
    path.join(root, 'main.js'),
    `
import { createLocalizer as rootLocalizer } from '@link-foundation/ui-i18n';
import { importDom } from '@link-foundation/ui-convert/browser';
import { createLocalizer, message, loadUiCatalogs } from '@link-foundation/ui-i18n/browser';
globalThis.openInspector = async () => {
  try {
    if (rootLocalizer !== createLocalizer) throw new Error('Browser condition was not selected');
    const catalogs = await loadUiCatalogs();
    const localizer = createLocalizer({ catalogs, locale: 'en' });
    globalThis.consumerResult = { text: localizer.text(message('ui.dialog.close')), ids: [...importDom(document.querySelector('main')).tree.byId.keys()] };
    const { mountForeignDevMode } = await import('@link-foundation/ui-devmode/foreign');
    const { renderAgentInstruction } = await import('@link-foundation/ui-devmode/agent-instruction');
    globalThis.consumerResult.instruction = renderAgentInstruction({ repository: 'consumer' });
    globalThis.controller = await mountForeignDevMode();
    document.querySelector('#status').textContent = 'Inspector open';
  } catch (error) {
    document.querySelector('#status').textContent = error.message;
    throw error;
  }
};
document.querySelector('#open').onclick = globalThis.openInspector;
`
  );
  const warnings = [];
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    base: '/consumer/',
    build: {
      target: 'es2022',
      assetsInlineLimit: inline ? 100000 : 0,
      rollupOptions: { onwarn: (warning) => warnings.push(warning.message) },
    },
  });
  return {
    root,
    warnings,
    async serve() {
      return await preview({
        root,
        configFile: false,
        base: '/consumer/',
        logLevel: 'silent',
        preview: { host: '127.0.0.1', port: 0 },
      });
    },
  };
}
