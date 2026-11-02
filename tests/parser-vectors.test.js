/**
 * Tests for docs/spec/parser-vectors.json, the parser vectors the native
 * Links Notation parsers (native/swift/LinksNotation) are checked against,
 * and for the copy of the upstream parity corpus vendored with the Swift port.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Parser, formatLinks } from 'links-notation';
import {
  VECTORS_FILE,
  buildVectors,
  linkTree,
  renderVectors,
} from '../scripts/generate-parser-vectors.mjs';

const PARITY_CORPUS = 'native/swift/LinksNotation/parity/text-fixtures.json';

describe('docs/spec/parser-vectors.json', () => {
  it('is what scripts/generate-parser-vectors.mjs writes now', () => {
    // When this fails, run: node scripts/generate-parser-vectors.mjs
    expect(readFileSync(VECTORS_FILE, 'utf8')).toBe(renderVectors());
  });

  it('has one vector per fixture, syntax-* fixtures as errors', () => {
    const vectors = JSON.parse(readFileSync(VECTORS_FILE, 'utf8'));
    expect(vectors.length >= 30).toBe(true);
    for (const vector of vectors) {
      const name = vector.id.slice(vector.id.lastIndexOf('/') + 1);
      expect(vector.error === true).toBe(name.startsWith('syntax-'));
    }
    const codes = vectors.filter((v) => v.error).map((v) => v.code);
    expect(codes.includes('syntax-error')).toBe(true);
    expect(codes.includes('depth-exceeded')).toBe(true);
  });

  it('places every error where the diagnostics fixture places it', () => {
    const vectors = JSON.parse(readFileSync(VECTORS_FILE, 'utf8'));
    for (const vector of vectors.filter((v) => v.error)) {
      const file = path.join(
        'docs/spec/fixtures',
        `${vector.id}.diagnostics.json`
      );
      const [diagnostic] = JSON.parse(readFileSync(file, 'utf8')).diagnostics;
      expect({ code: vector.code, ...diagnostic.at }).toEqual({
        code: diagnostic.code,
        line: vector.line,
        column: vector.column,
      });
    }
  });

  it('refuses to write vectors for a syntax-* fixture that parses', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vectors-'));
    try {
      cpSync('docs/spec/fixtures', dir, { recursive: true });
      writeFileSync(
        path.join(dir, 'errors', 'syntax-unquoted-hex.lino'),
        '(a b)'
      );
      expect(() => buildVectors(dir)).toThrow(/must be refused/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the parity corpus vendored with the Swift port', () => {
  it('agrees with the links-notation package the repository uses', () => {
    const corpus = JSON.parse(readFileSync(PARITY_CORPUS, 'utf8'));
    expect(corpus.length).toBe(14);
    const parser = new Parser();
    for (const { input, expected, format } of corpus) {
      const links = parser.parse(input);
      expect(links.map(linkTree)).toEqual(expected);
      expect(formatLinks(links)).toBe(format);
    }
  });
});
