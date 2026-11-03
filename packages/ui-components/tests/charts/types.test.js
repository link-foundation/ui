/**
 * The type declarations cover the runtime exports of the chart entries and
 * of the root entry, whose declarations re-export the entries'
 * (`export * from '@link-foundation/ui-components/charts'`).
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import * as charts from '../../src/charts/index.js';
import * as echarts from '../../src/charts/echarts-adapter.js';
import * as root from '../../src/index.js';

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

const SELF = `${pkg.name}/`;

/**
 * The names a declaration file exports, following `export * from` the
 * package's own entries.
 */
function declared(path) {
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const names = new Set(
    [
      ...text.matchAll(
        /^export (?:declare )?(?:const|function|class) (\w+)/gmu
      ),
    ].map((match) => match[1])
  );
  for (const [, specifier] of text.matchAll(/^export \* from '([^']+)';/gmu)) {
    if (specifier.startsWith(SELF)) {
      const entry = `./${specifier.slice(SELF.length)}`;
      for (const name of declared(pkg.exports[entry].types)) {
        names.add(name);
      }
    }
  }
  return names;
}

describe('type declarations', () => {
  for (const [entry, module] of [
    ['.', root],
    ['./charts', charts],
    ['./charts/echarts', echarts],
  ]) {
    it(`declare every export of ${entry}`, () => {
      const { types, default: file } = pkg.exports[entry];
      expect(typeof file).toBe('string');
      const names = declared(types);
      expect(Object.keys(module).filter((name) => !names.has(name))).toEqual(
        []
      );
    });
  }
});
