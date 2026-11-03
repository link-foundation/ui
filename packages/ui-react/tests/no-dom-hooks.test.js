/**
 * `@link-foundation/ui-react/hooks` is DOM-free: importing it, in a fresh
 * Node process with no DOM globals, loads no module of `react-dom` or
 * `ui-dom`. A module resolve hook records every module URL the import
 * loads; the main entry is the positive control (it does load both).
 */

import { describe, it, expect } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

/**
 * The child script: record every resolved module URL with an in-thread
 * `registerHooks` (Node 22.15+), else an off-thread `register` hook.
 */
const OFF_THREAD_HOOKS = `
let port;
export function initialize(data) { port = data.port; }
export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  port.postMessage(result.url);
  return result;
}`;

const childScript = (entry) => `
  import * as module from 'node:module';
  import { MessageChannel } from 'node:worker_threads';
  const urls = [];
  let close = () => {};
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, next) {
        const result = next(specifier, context);
        urls.push(result.url);
        return result;
      },
    });
  } else {
    const { port1, port2 } = new MessageChannel();
    port1.on('message', (url) => urls.push(url));
    module.register(
      'data:text/javascript,' + encodeURIComponent(${JSON.stringify(OFF_THREAD_HOOKS)}),
      { data: { port: port2 }, transferList: [port2] }
    );
    close = () => port1.close();
  }
  const globals = ['window', 'document', 'HTMLElement', 'customElements']
    .filter((name) => typeof globalThis[name] !== 'undefined');
  await import(${JSON.stringify(entry)});
  await new Promise((resolve) => setTimeout(resolve, 50));
  close();
  process.stdout.write(JSON.stringify({ urls, globals }));
`;

/** Every module URL that importing `entry` loads, in a fresh process. */
function loadedModules(entry) {
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', childScript(entry)],
    { cwd: PACKAGE_DIR, encoding: 'utf8' }
  );
  return JSON.parse(out);
}

const isReactDom = (url) => /[/\\]react-dom[/\\]/.test(url);
const isUiDom = (url) => /[/\\]ui-dom[/\\]/.test(url);

describe('the hooks entry', () => {
  it('loads no react-dom or ui-dom module and needs no DOM', () => {
    const { urls, globals } = loadedModules('@link-foundation/ui-react/hooks');
    expect(globals).toEqual([]);
    expect(urls.some((url) => url.endsWith('/ui-react/src/hooks.js'))).toBe(
      true
    );
    expect(urls.some((url) => /[/\\]react[/\\]/.test(url))).toBe(true);
    expect(urls.filter(isReactDom)).toEqual([]);
    expect(urls.filter(isUiDom)).toEqual([]);
  });

  it('is told apart from the main entry, which loads both', () => {
    const { urls } = loadedModules('@link-foundation/ui-react');
    expect(urls.some(isReactDom)).toBe(true);
    expect(urls.some(isUiDom)).toBe(true);
  });
});
