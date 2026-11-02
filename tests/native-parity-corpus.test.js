/**
 * The vendored upstream parity corpus (native/parity/text-fixtures.json) must
 * agree with the JavaScript links-notation package pinned in package.json,
 * the reference the native ports are compared with.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { Parser, formatLinks } from 'links-notation';
import { linkToJson } from '../scripts/generate-parser-vectors.mjs';

const CORPUS = JSON.parse(
  readFileSync('native/parity/text-fixtures.json', 'utf8')
);

describe('native parity corpus', () => {
  it('has the 14 upstream cases with unique ids', () => {
    expect(CORPUS.length >= 14).toBe(true);
    expect(new Set(CORPUS.map((c) => c.id)).size).toBe(CORPUS.length);
  });

  for (const testCase of CORPUS) {
    it(`agrees with links-notation: ${testCase.id}`, () => {
      const links = new Parser().parse(testCase.input);
      expect(links.map(linkToJson)).toEqual(testCase.expected);
      expect(formatLinks(links)).toBe(testCase.format);
      expect(new Parser().parse(testCase.format).map(linkToJson)).toEqual(
        testCase.expected
      );
    });
  }
});
