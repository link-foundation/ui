/**
 * Every example page maps each bare static import its modules reach: the
 * page's own module scripts and, through relative imports, every source
 * file a mapped `/packages/...` entry loads. A lazy `import('x')` is an
 * optional dependency, loaded only when asked for, and is not required.
 * A bare import the map does not name fails in the browser before anything
 * is drawn (#133: the chart and diagram readers import
 * `@link-foundation/ui-core`).
 */

import { describe, it, expect } from 'test-anywhere';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = new URL('../../../', import.meta.url);
const examples = new URL('../examples/', import.meta.url);

const IMPORT =
  /(?:^|[\s;])(?:import|export)\s[^'"`;()]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s+['"]([^'"]+)['"]/gmu;

/** The specifiers a module's code imports statically, comments left out. */
function importsOf(code) {
  const bare = code
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');
  return [...bare.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);
}

const isBare = (specifier) => !/^(?:\.{0,2}\/|[a-z]+:)/u.test(specifier);

/** The bare specifiers reached from `file` through relative imports. */
function bareImports(file, seen = new Set()) {
  if (seen.has(file.href) || !existsSync(file)) {
    return [];
  }
  seen.add(file.href);
  return importsOf(readFileSync(file, 'utf8')).flatMap((specifier) =>
    isBare(specifier)
      ? [specifier]
      : bareImports(new URL(specifier, file), seen)
  );
}

const pages = readdirSync(examples).filter((name) => name.endsWith('.html'));

describe('the import maps of the example pages', () => {
  it('finds the pages', () => {
    expect(pages.includes('charts.html')).toBe(true);
    expect(pages.includes('diagrams.html')).toBe(true);
  });

  for (const name of pages) {
    it(`map every bare import of ${name}`, () => {
      const pageUrl = new URL(name, examples);
      const { document } = new JSDOM(readFileSync(pageUrl, 'utf8')).window;
      const mapScript = document.querySelector('script[type="importmap"]');
      if (mapScript === null) {
        return;
      }
      const { imports } = JSON.parse(mapScript.textContent);
      const seen = new Set();
      const needed = [
        ...document.querySelectorAll('script[type="module"]'),
      ].flatMap((script) =>
        script.src
          ? bareImports(new URL(script.getAttribute('src'), pageUrl), seen)
          : importsOf(script.textContent).flatMap((specifier) =>
              isBare(specifier)
                ? [specifier]
                : bareImports(new URL(specifier, pageUrl), seen)
            )
      );
      for (const path of Object.values(imports)) {
        if (path.startsWith('/packages/')) {
          needed.push(...bareImports(new URL(`.${path}`, root), seen));
        }
      }
      const missing = [...new Set(needed)].filter(
        (specifier) =>
          !(specifier in imports) &&
          !Object.keys(imports).some(
            (key) => key.endsWith('/') && specifier.startsWith(key)
          )
      );
      expect(missing).toEqual([]);
    });
  }
});
