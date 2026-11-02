/**
 * Tests for scripts/generate-parser-vectors.mjs and the freshness of
 * docs/spec/parser-vectors.json, the parser vectors the Swift (#29) and Kotlin
 * (#31) ports run.
 */

import { describe, it, expect } from 'test-anywhere';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkVectors,
  FIXTURES_DIR,
  generateVectors,
  listFixtures,
  mustBeRejected,
  vectorFor,
  VECTORS_FILE,
} from '../scripts/generate-parser-vectors.mjs';

/** Run `body` with a temporary directory, removed afterwards. */
function withTempDir(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'parser-vectors-'));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('parser vectors', () => {
  it('docs/spec/parser-vectors.json is fresh', () => {
    expect(checkVectors()).toBe(null);
  });

  it('has one vector per fixture, in fixture order', () => {
    const vectors = JSON.parse(generateVectors());
    const fixtures = listFixtures();
    expect(vectors.length).toBe(fixtures.length);
    expect(vectors.map((v) => `${v.id}.lino`)).toEqual(fixtures);
    expect(fixtures.length >= 30).toBe(true);
  });

  it('marks exactly the errors/syntax-* fixtures as errors', () => {
    const vectors = JSON.parse(generateVectors());
    for (const vector of vectors) {
      expect(vector.error === true).toBe(mustBeRejected(`${vector.id}.lino`));
    }
    const errors = vectors.filter((v) => v.error);
    expect(errors.map((v) => [v.id, v.code, v.line, v.column])).toEqual([
      ['errors/syntax-colon-in-value', 'syntax-error', 1, 19],
      ['errors/syntax-depth-exceeded', 'depth-exceeded', 1, 202],
      ['errors/syntax-unquoted-hex', 'syntax-error', 2, 1],
    ]);
  });

  it('writes the upstream parity case shape', () => {
    expect(vectorFor('elements/a.lino', '(button: (label Save))\n')).toEqual({
      id: 'elements/a',
      input: '(button: (label Save))\n',
      expected: [
        {
          id: 'button',
          values: [
            {
              id: null,
              values: [
                { id: 'label', values: [] },
                { id: 'Save', values: [] },
              ],
            },
          ],
        },
      ],
      format: '(button: (label Save))',
    });
  });

  it('refuses a syntax-* fixture that parses and a fixture that does not', () => {
    expect(() => vectorFor('errors/syntax-x.lino', 'a b\n')).toThrow();
    expect(() => vectorFor('elements/x.lino', '(a: b: c)\n')).toThrow();
  });

  it('reports a stale or missing vector file', () => {
    withTempDir((dir) => {
      const fixtures = path.join(dir, 'fixtures');
      mkdirSync(path.join(fixtures, 'elements'), { recursive: true });
      writeFileSync(path.join(fixtures, 'elements', 'a.lino'), 'a\n');
      const file = path.join(dir, 'parser-vectors.json');
      expect(checkVectors(file, fixtures)).toContain('is missing');
      writeFileSync(file, generateVectors(fixtures));
      expect(checkVectors(file, fixtures)).toBe(null);
      writeFileSync(path.join(fixtures, 'elements', 'a.lino'), 'b\n');
      expect(checkVectors(file, fixtures)).toContain('is stale');
    });
  });

  it('reads a CRLF checkout of the fixtures as the LF text', () => {
    // Windows checkouts turn LF line ends into CRLF.
    withTempDir((dir) => {
      const fixtures = path.join(dir, 'fixtures');
      mkdirSync(path.join(fixtures, 'elements'), { recursive: true });
      const fixture = path.join(fixtures, 'elements', 'a.lino');
      writeFileSync(fixture, 'a:\n  b\n');
      const lf = generateVectors(fixtures);
      writeFileSync(fixture, 'a:\r\n  b\r\n');
      expect(generateVectors(fixtures)).toBe(lf);
      const file = path.join(dir, 'parser-vectors.json');
      writeFileSync(file, lf.replaceAll('\n', '\r\n'));
      expect(checkVectors(file, fixtures)).toBe(null);
    });
  });

  it('exports the default paths', () => {
    expect(FIXTURES_DIR).toBe('docs/spec/fixtures');
    expect(VECTORS_FILE).toBe('docs/spec/parser-vectors.json');
  });
});
