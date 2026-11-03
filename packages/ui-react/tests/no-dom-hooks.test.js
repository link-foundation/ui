/**
 * `@link-foundation/ui-react/hooks` is DOM-free:
 *
 * - a static module graph walk from the entry (resolved through the
 *   `exports` map of ui-react) reaches no module of `react-dom` or
 *   `ui-dom`, under any export condition; the main entry is the positive
 *   control (its graph has both);
 * - importing the entry in a fresh process of the same runtime (Node.js,
 *   Bun or Deno), with no DOM globals, works and installs none.
 */

import { describe, it, expect } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { moduleGraph } from './module-graph.js';

const HERE = fileURLToPath(import.meta.url);
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const HOOKS_URL = pathToFileURL(
  fileURLToPath(new URL('../src/hooks.js', import.meta.url))
).href;

const isReactDom = (name) => /(^|[/\\])react-dom([/\\]|$)/.test(name);
const isUiDom = (name) => /(^|[/\\])ui-dom([/\\]|$)/.test(name);
const isReact = (name) => /[/\\]react[/\\]/.test(name);

/** The child script: import the entry with no DOM globals and use it. */
const CHILD_SCRIPT = `
const DOM = ['window', 'document', 'HTMLElement', 'customElements'];
const present = () => DOM.filter((name) => typeof globalThis[name] !== 'undefined');
const before = present();
const hooks = await import(${JSON.stringify(HOOKS_URL)});
const registry = hooks.createActionRegistry();
let saved = null;
registry.register('save', (detail) => (saved = detail.source));
registry.dispatch({ source: 'ok', event: 'press', action: ['emit', 'save'] });
console.log(JSON.stringify({
  before,
  after: present(),
  saved,
  exports: Object.keys(hooks).sort(),
}));
`;

/** The command line that evaluates an ES module script in this runtime. */
function evalCommand(script) {
  if (globalThis.Deno) {
    return [globalThis.Deno.execPath(), ['eval', script]];
  }
  if (globalThis.Bun) {
    return [process.execPath, ['--eval', script]];
  }
  return [process.execPath, ['--input-type=module', '--eval', script]];
}

describe('the hooks entry', () => {
  it('reaches no react-dom or ui-dom module in its module graph', () => {
    const { files, unresolved } = moduleGraph(
      '@link-foundation/ui-react/hooks',
      HERE
    );
    expect(files[0].endsWith('hooks.js')).toBe(true);
    expect(files.some(isReact)).toBe(true);
    expect(files.filter(isReactDom)).toEqual([]);
    expect(files.filter(isUiDom)).toEqual([]);
    expect(unresolved.filter(isReactDom)).toEqual([]);
    expect(unresolved.filter(isUiDom)).toEqual([]);
  });

  it('is told apart from the main entry, whose graph has both', () => {
    const { files } = moduleGraph('@link-foundation/ui-react', HERE);
    expect(files.some(isReactDom)).toBe(true);
    expect(files.some(isUiDom)).toBe(true);
  });

  it('imports and runs in a fresh process with no DOM globals', () => {
    const [command, args] = evalCommand(CHILD_SCRIPT);
    const out = execFileSync(command, args, {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    });
    const result = JSON.parse(out.trim().split('\n').at(-1));
    expect(result.before).toEqual([]);
    expect(result.after).toEqual([]);
    expect(result.saved).toBe('ok');
    expect(result.exports).toContain('useUiProp');
    expect(result.exports).toContain('UiProvider');
  });
});
