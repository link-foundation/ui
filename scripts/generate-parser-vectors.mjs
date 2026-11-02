#!/usr/bin/env node

/**
 * Write docs/spec/parser-vectors.json: what the reference Links Notation
 * parser (the JavaScript `links-notation` package) makes of every fixture of
 * the ui-dialect/0 specification, so that the native parsers (Swift first,
 * native/swift/LinksNotation) can be checked against it without Node.js.
 *
 * Each `docs/spec/fixtures/**\/*.lino` becomes one vector, in path order,
 * identified by its path below fixtures/ without `.lino`:
 *
 * - a fixture the parser reads gives `input`, the links it reads (`expected`,
 *   as `{id, values}` trees) and the text `formatLinks` writes for them
 *   (`format`), which the parser must read back into the same links;
 * - a fixture named `syntax-*` must be refused: it gives `error: true`, the
 *   diagnostic `code` (`syntax-error` or `depth-exceeded`), the `line` and
 *   `column` the parser reports and its `message`.
 *
 * The parser runs with the limits of docs/spec/limits.md.
 *
 * Usage:
 *   node scripts/generate-parser-vectors.mjs          # rewrite the vectors
 *   node scripts/generate-parser-vectors.mjs --check  # exit 1 when stale
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, formatLinks } from 'links-notation';
import { MAX_DEPTH, MAX_INPUT_SIZE } from './spec-reference-projection.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES_DIR = join(root, 'docs', 'spec', 'fixtures');
export const VECTORS_FILE = join(root, 'docs', 'spec', 'parser-vectors.json');

/** Every `.lino` below `dir`, in path order. */
function linoFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return linoFiles(path);
      }
      return entry.name.endsWith('.lino') ? [path] : [];
    })
    .sort();
}

/** A link as the `{id, values}` tree of the upstream parity corpus. */
export function linkTree(link) {
  return { id: link.id ?? null, values: (link.values ?? []).map(linkTree) };
}

/**
 * The vector for one document.
 * @param {string} id - Path of the fixture below fixtures/, without `.lino`
 * @param {string} input - The document
 * @param {boolean} mustFail - Whether the parser must refuse it
 */
export function vectorFor(id, input, mustFail) {
  const parser = new Parser({
    maxDepth: MAX_DEPTH,
    maxInputSize: MAX_INPUT_SIZE,
  });
  let links;
  try {
    links = parser.parse(input);
  } catch (error) {
    if (!mustFail || error.name !== 'ParseError') {
      throw new Error(`${id}: ${error.message}`, { cause: error });
    }
    return {
      id,
      input,
      error: true,
      code: error.maxDepth === null ? 'syntax-error' : 'depth-exceeded',
      line: error.line,
      column: error.column,
      message: error.cause.message,
    };
  }
  if (mustFail) {
    throw new Error(`${id}: parses, but syntax-* fixtures must be refused`);
  }
  const format = formatLinks(links);
  const expected = links.map(linkTree);
  const reparsed = parser.parse(format).map(linkTree);
  if (JSON.stringify(reparsed) !== JSON.stringify(expected)) {
    throw new Error(`${id}: the formatted text does not read back the same`);
  }
  return { id, input, expected, format };
}

/** Every vector of the fixtures in `fixturesDir`. */
export function buildVectors(fixturesDir = FIXTURES_DIR) {
  return linoFiles(fixturesDir).map((file) => {
    const id = relative(fixturesDir, file)
      .split(sep)
      .join('/')
      .replace(/\.lino$/, '');
    const name = id.slice(id.lastIndexOf('/') + 1);
    return vectorFor(
      id,
      readFileSync(file, 'utf8'),
      name.startsWith('syntax-')
    );
  });
}

/**
 * The text of docs/spec/parser-vectors.json: a JSON array with one vector per
 * line, so the file stays short and each fixture changes one line (prettier
 * leaves it alone; see .prettierignore).
 */
export function renderVectors(fixturesDir = FIXTURES_DIR) {
  const lines = buildVectors(fixturesDir).map((v) => `  ${JSON.stringify(v)}`);
  return `[\n${lines.join(',\n')}\n]\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = renderVectors();
  let actual = null;
  try {
    actual = readFileSync(VECTORS_FILE, 'utf8');
  } catch {
    // Missing: stale.
  }
  if (expected === actual) {
    console.log('docs/spec/parser-vectors.json is up to date');
  } else if (process.argv.includes('--check')) {
    console.error(
      'docs/spec/parser-vectors.json is stale; run node scripts/generate-parser-vectors.mjs'
    );
    process.exitCode = 1;
  } else {
    writeFileSync(VECTORS_FILE, expected);
    console.log('updated docs/spec/parser-vectors.json');
  }
}
