/**
 * The `./behavior` entry point imports nothing from the DOM or ui-dom: it
 * loads and runs in a process without `window` or `document`, and its
 * import graph never reaches ui-dom or the a11y (DOM) helpers.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { describe, it, expect } from 'test-anywhere';

const ENTRY = new URL('../../src/behavior/index.js', import.meta.url);

/** Every module of the entry's relative import graph, with its imports. */
function importGraph(entry) {
  const graph = new Map();
  const visit = (url) => {
    if (graph.has(url.href)) {
      return;
    }
    const source = readFileSync(url, 'utf8');
    const specifiers = [
      ...source.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+'([^']+)'/gm),
      ...source.matchAll(/^\s*import\s+'([^']+)'/gm),
      ...source.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g),
    ].map((match) => match[1]);
    graph.set(url.href, specifiers);
    specifiers
      .filter((s) => s.startsWith('.'))
      .forEach((s) => visit(new URL(s, url)));
  };
  visit(entry);
  return graph;
}

describe('behavior: no DOM', () => {
  it('imports no DOM module, ui-dom or a11y helper', () => {
    const graph = importGraph(ENTRY);
    const files = [...graph.keys()].map((href) => fileURLToPath(href));
    expect(files.length > 3).toBe(true);
    expect(files.some((file) => file.includes('/a11y/'))).toBe(false);
    expect(files.some((file) => file.endsWith('/behavior/dom.js'))).toBe(false);
    const bare = [...graph.values()].flat().filter((s) => !s.startsWith('.'));
    expect([...new Set(bare)]).toEqual(['@link-foundation/ui-core']);
  });

  it('loads and runs a machine in a process without window or document', () => {
    const script = fileURLToPath(
      new URL('fixtures/run-without-dom.mjs', import.meta.url)
    );
    // Deno runs a file with `deno run`; Node and Bun take the file itself.
    const args = globalThis.Deno ? ['run', '-A', script] : [script];
    const output = execFileSync(process.execPath, args, { encoding: 'utf8' });
    expect(JSON.parse(output)).toEqual(['on', { 'aria-pressed': 'true' }]);
  });
});
