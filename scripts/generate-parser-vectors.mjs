#!/usr/bin/env node

/**
 * Generate docs/spec/parser-vectors.json: the parser-level vectors of the
 * ui-dialect/0 conformance fixtures, read with the JavaScript reference
 * `links-notation` parser (the version pinned in package.json).
 *
 * Native ports (the Swift port of #29, the Kotlin port of #31) run the same
 * assertions over these vectors as over the upstream parity corpus
 * (`parity/text-fixtures.json`), so every vector has the same shape as an
 * upstream parity case:
 *
 *   { "id", "input", "expected": [{ "id", "values" }], "format" }
 *
 * `id: null` marks an anonymous link. A fixture the parser must reject
 * (`errors/syntax-*.lino`) has no `expected` and no `format`; it has
 * `"error": true`, the diagnostic code of docs/spec/limits.md
 * (`syntax-error` or `depth-exceeded`) and the 1-based line and column the
 * JavaScript parser reports.
 *
 * Usage:
 *   node scripts/generate-parser-vectors.mjs          # write the file
 *   node scripts/generate-parser-vectors.mjs --check  # fail when it is stale
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, formatLinks } from 'links-notation';

/** Deepest nesting a ui-dialect/0 document may have (docs/spec/limits.md). */
export const MAX_DEPTH = 64;

/** Largest ui-dialect/0 document, in UTF-16 code units (docs/spec/limits.md). */
export const MAX_INPUT_SIZE = 1024 * 1024;

export const FIXTURES_DIR = 'docs/spec/fixtures';
export const VECTORS_FILE = 'docs/spec/parser-vectors.json';

/** Every `.lino` fixture under `dir`, as sorted POSIX paths relative to it. */
export function listFixtures(dir = FIXTURES_DIR) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith('.lino')) {
        found.push(relative(dir, path).split('\\').join('/'));
      }
    }
  };
  walk(dir);
  return found.sort();
}

/** A parsed link as the plain `{ id, values }` tree of the parity corpus. */
export function linkToJson(link) {
  return {
    id: link.id ?? null,
    values: (link.values ?? []).map(linkToJson),
  };
}

/** Whether the fixture at `name` (relative to the fixtures dir) must be rejected. */
export function mustBeRejected(name) {
  return /^errors\/syntax-[^/]*\.lino$/.test(name);
}

/** The parser vector of one fixture. */
export function vectorFor(name, input) {
  const id = name.replace(/\.lino$/, '');
  const parser = new Parser({
    maxDepth: MAX_DEPTH,
    maxInputSize: MAX_INPUT_SIZE,
  });
  let links;
  try {
    links = parser.parse(input);
  } catch (error) {
    if (!mustBeRejected(name)) {
      throw new Error(`${name} must parse: ${error.message}`, {
        cause: error,
      });
    }
    return {
      id,
      input,
      error: true,
      code: error.maxDepth ? 'depth-exceeded' : 'syntax-error',
      line: error.line,
      column: error.column,
    };
  }
  if (mustBeRejected(name)) {
    throw new Error(`${name} must be rejected by the parser`);
  }
  return {
    id,
    input,
    expected: links.map(linkToJson),
    format: formatLinks(links),
  };
}

/** The whole vector file, as the text written to disk. */
export function generateVectors(dir = FIXTURES_DIR) {
  // A Windows checkout may turn the fixtures' LF line ends into CRLF; the
  // vectors are always generated from the LF text the repository stores.
  const vectors = listFixtures(dir).map((name) =>
    vectorFor(
      name,
      readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n')
    )
  );
  return `${JSON.stringify(vectors, null, 2)}\n`;
}

/** Compare the file with a fresh generation; returns an error string or null. */
export function checkVectors(file = VECTORS_FILE, dir = FIXTURES_DIR) {
  let current;
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    return `${file} is missing; run node scripts/generate-parser-vectors.mjs`;
  }
  if (current.replace(/\r\n/g, '\n') !== generateVectors(dir)) {
    return `${file} is stale; run node scripts/generate-parser-vectors.mjs`;
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const error = checkVectors();
    if (error) {
      console.error(error);
      process.exit(1);
    }
    console.log(`${VECTORS_FILE} is up to date`);
  } else {
    writeFileSync(VECTORS_FILE, generateVectors());
    console.log(`wrote ${VECTORS_FILE}`);
  }
}
