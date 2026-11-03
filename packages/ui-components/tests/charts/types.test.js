/**
 * The type declarations cover the runtime exports of every entry of the
 * package (`.` and `./charts` share src/index.d.ts).
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

/** The names a declaration file exports. */
const declared = (path) =>
  new Set(
    [
      ...readFileSync(
        new URL(`../../${path}`, import.meta.url),
        'utf8'
      ).matchAll(/^export (?:declare )?(?:const|function|class) (\w+)/gmu),
    ].map((match) => match[1])
  );

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
