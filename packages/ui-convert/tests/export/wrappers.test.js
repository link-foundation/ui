import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { exportDocument } from '../../src/index.js';
import { fixture, fixtures } from './helpers.js';

// Load both framework runtimes only after installing the DOM, as their adapters require.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.test/',
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'SVGElement',
  'CustomEvent',
  'MutationObserver',
  'customElements',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { default: vuePlugin } = await import('@vitejs/plugin-vue');
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { UiView: ReactView } = await import('@link-foundation/ui-react');
const Vue = await import('vue');
const { UiView: VueView } = await import('@link-foundation/ui-vue');

/** Build real generated files through Vite, keeping framework runtime identity. */
async function compiled(target, source, use, mode = 'wrapper') {
  // Keep generated modules inside this package's dependency scope for Deno.
  const dir = mkdtempSync(resolve('packages/ui-convert/.ui-export-'));
  // Vite otherwise sets production globally, including Deno's parallel workers.
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV ??= 'test';
  try {
    const result = await exportDocument(source, { target, mode });
    const entry = join(dir, result.files[0].path);
    for (const file of result.files) {
      writeFileSync(join(dir, file.path), file.contents);
    }
    const output = await build({
      configFile: false,
      root: dir,
      logLevel: 'silent',
      plugins: target === 'vue' ? [vuePlugin()] : [],
      esbuild: { jsx: 'automatic' },
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['es'] },
        rollupOptions: {
          external: [
            'react',
            'react/jsx-runtime',
            'vue',
            '@link-foundation/ui-react',
            '@link-foundation/ui-vue',
          ],
        },
      },
    });
    const code = (Array.isArray(output) ? output[0] : output).output.find(
      (file) => file.type === 'chunk'
    ).code;
    const module = join(dir, 'compiled.mjs');
    writeFileSync(module, code);
    await use(await import(pathToFileURL(module).href));
  } finally {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function host() {
  const element = dom.window.document.createElement('div');
  dom.window.document.body.append(element);
  return element;
}

test('Vite builds leave NODE_ENV unchanged for other test workers', async () => {
  const before = process.env.NODE_ENV;
  await compiled('react', fixture('document'), async () => {});
  assert.equal(process.env.NODE_ENV, before);
});

for (const target of ['react', 'vue']) {
  for (const name of fixtures) {
    test(`${target} ${name}: Vite build and live DOM equal original UiView`, async () => {
      const source = fixture(name);
      await compiled(target, source, async (module) => {
        const generated = host();
        const original = host();
        if (target === 'react') {
          const a = createRoot(generated);
          const b = createRoot(original);
          try {
            await React.act(async () => {
              a.render(React.createElement(module.App));
              b.render(React.createElement(ReactView, { source }));
            });
            assert.equal(generated.innerHTML, original.innerHTML);
          } finally {
            await React.act(async () => {
              a.unmount();
              b.unmount();
            });
          }
        } else {
          const a = Vue.createApp(module.default);
          const b = Vue.createApp(VueView, { source });
          try {
            a.mount(generated);
            b.mount(original);
            await Vue.nextTick();
            assert.equal(generated.innerHTML, original.innerHTML);
          } finally {
            a.unmount();
            b.unmount();
          }
        }
        generated.remove();
        original.remove();
      });
    });
  }
}

test('compiled wrappers preserve hostile template characters byte for byte', async () => {
  const source =
    "app: document\n  t: text '` ${globalThis.noSuchValue} \\\\ </script> & < > { }'\n    magic '</script> */ --'\n";
  for (const target of ['react', 'vue']) {
    await compiled(target, source, async (module) => {
      const container = host();
      if (target === 'react') {
        const root = createRoot(container);
        try {
          await React.act(async () => {
            root.render(React.createElement(module.App));
          });
          assert.match(container.textContent, /\$\{globalThis.noSuchValue\}/);
          assert.match(container.textContent, /<\/script>/);
        } finally {
          await React.act(async () => root.unmount());
        }
      } else {
        const app = Vue.createApp(module.default);
        try {
          app.mount(container);
          await Vue.nextTick();
          assert.match(container.textContent, /<\/script>/);
        } finally {
          app.unmount();
        }
      }
      container.remove();
    });
  }
});

for (const target of ['react', 'vue']) {
  for (const mode of ['wrapper', 'eject']) {
    test(`${target}/${mode}: generated button calls an overridden action`, async () => {
      const source = fixture('document');
      await compiled(
        target,
        source,
        async (module) => {
          const container = host();
          const calls = [];
          const actions = { navigate: (...args) => calls.push(args) };
          if (target === 'react') {
            const root = createRoot(container);
            try {
              await React.act(async () => {
                root.render(React.createElement(module.App, { actions }));
              });
              await React.act(async () =>
                container.querySelector('button').click()
              );
            } finally {
              await React.act(async () => root.unmount());
            }
          } else {
            const app = Vue.createApp(module.default, { actions });
            try {
              app.mount(container);
              await Vue.nextTick();
              container.querySelector('button').click();
              await Vue.nextTick();
            } finally {
              app.unmount();
            }
          }
          assert.equal(calls.length, 1);
          if (mode === 'wrapper') {
            assert.deepEqual(calls[0][0].action, ['navigate', 'home']);
          } else {
            assert.deepEqual(calls[0], ['home']);
          }
          container.remove();
        },
        mode
      );
    });
  }
}
