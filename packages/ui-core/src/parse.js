/**
 * `parse(text)`: Links Notation text -> UI element tree (docs/spec/).
 *
 * Text is read only by the official `links-notation` parser; the projection
 * works on the `Link` objects it returns. `parse` never throws: every
 * problem, including parser errors and the limits, becomes a diagnostic.
 */

import { Link, Parser } from 'links-notation';
import { checkTree } from './check.js';
import { diagnostic, diagnosticJson } from './diagnostics.js';
import { projectLinks } from './project.js';
import { defaultVocabulary } from './vocabulary.js';

/** The dialect version written into every tree. */
export const SPEC_VERSION = 'ui-dialect/0';
/** How deep links may nest (docs/spec/limits.md). */
export const DEFAULT_MAX_DEPTH = 64;
/** The largest accepted input, in characters (docs/spec/limits.md). */
export const DEFAULT_MAX_INPUT_SIZE = 1024 * 1024;

/**
 * A group of `Parser.parseGroups()` as one link: the indented lines are
 * appended to the values of the line they are indented under.
 * @param {import('links-notation').LinksGroup} group
 * @returns {Link}
 */
function unindent(group) {
  const { element, children } = group;
  return children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
}

function readLinks(parser, text, mode) {
  return mode === 'fold'
    ? parser.parse(text)
    : parser.parseGroups(text).map(unindent);
}

/**
 * The diagnostic for an error thrown by the parser.
 * @param {Error & { maxDepth?: number, line?: number, column?: number }} error
 */
function parserDiagnostic(error) {
  const at = error.line ? { line: error.line, column: error.column } : {};
  // The parser reports maxDepth; a host stack overflow (only possible with a
  // very large maxDepth) is the same problem: the input nests too deep.
  const tooDeep = error.maxDepth || error.cause instanceof RangeError;
  const code = tooDeep ? 'depth-exceeded' : 'syntax-error';
  return diagnostic(code, 'error', at, error.message);
}

const emptyDocument = (diagnostics) => ({
  spec: SPEC_VERSION,
  roots: [],
  unknown: [],
  byId: new Map(),
  diagnostics,
});

/**
 * Parse Links Notation text into a UI document. Never throws.
 * @param {string} text
 * @param {import('./types.js').ParseOptions} [options]
 * @returns {import('./types.js').UiDocument}
 */
export function parse(text, options = {}) {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    maxInputSize = DEFAULT_MAX_INPUT_SIZE,
    mode = 'auto',
    checks = true,
  } = options;
  if (typeof text !== 'string') {
    return emptyDocument([
      diagnostic('syntax-error', 'error', {}, 'The input is not a string'),
    ]);
  }
  if (text.length > maxInputSize) {
    return emptyDocument([diagnostic('input-too-large', 'error', {})]);
  }
  try {
    const vocabulary = options.vocabulary ?? defaultVocabulary();
    let links;
    try {
      const parser = new Parser({ maxDepth, maxInputSize: maxInputSize + 1 });
      links = readLinks(parser, text, mode);
    } catch (error) {
      return emptyDocument([parserDiagnostic(error)]);
    }
    const projected = projectLinks(links, vocabulary);
    if (checks) {
      checkTree(projected.roots, vocabulary, projected.diagnostics);
    }
    return { spec: SPEC_VERSION, ...projected };
  } catch (error) {
    // Only a host limit (such as a stack overflow on an extreme maxDepth)
    // can get here; it is reported, never thrown.
    return emptyDocument([
      diagnostic('depth-exceeded', 'error', {}, String(error?.message)),
    ]);
  }
}

/** Thrown by {@link parseOrThrow}; `diagnostics` holds every error. */
export class UiParseError extends Error {
  /**
   * @param {import('./types.js').Diagnostic[]} diagnostics
   * @param {import('./types.js').UiDocument} document
   */
  constructor(diagnostics, document) {
    super(diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
    this.name = 'UiParseError';
    this.diagnostics = diagnostics;
    this.document = document;
  }
}

/**
 * Like {@link parse}, but throws a {@link UiParseError} when there is any
 * diagnostic with severity `error`. Warnings stay on the document.
 * @param {string} text
 * @param {import('./types.js').ParseOptions} [options]
 * @returns {import('./types.js').UiDocument}
 */
export function parseOrThrow(text, options) {
  const document = parse(text, options);
  const errors = document.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new UiParseError(errors, document);
  }
  return document;
}

/**
 * The element tree JSON of docs/spec/element-tree.schema.json, the form the
 * spec fixtures (`*.tree.json`) are written in.
 * @param {import('./types.js').UiDocument} document
 */
export function toTree(document) {
  const tree = { spec: document.spec, elements: document.roots };
  if (document.unknown.length > 0) {
    tree.unknown = document.unknown;
  }
  tree.diagnostics = document.diagnostics.map(diagnosticJson);
  return tree;
}
