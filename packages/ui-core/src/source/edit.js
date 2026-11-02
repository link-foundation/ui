/**
 * Source-preserving edits of a UI document. Every function changes only the
 * text of the spans it edits, so comments, blank lines, quoting and layout
 * elsewhere stay byte for byte. It returns
 *
 *   { ok: true, text, edits: Array<{ start, end, insert }> }   or
 *   { ok: false, error, text }                                 (text unchanged)
 *
 * `edits` are in offsets of the input, sorted by `start`. Every edit is
 * checked: `parse(newText)` must deep-equal the tree the same op gives on
 * `parse(text)` (see `ops.js`); otherwise the edit is refused.
 *
 * Layout rules:
 * - a new line reuses the indentation of the nearest sibling;
 * - in the one-line form a node is inserted inline with one space;
 * - new values are quoted with `escapeReference`; a value written over keeps the
 *   quote it was written with when it can;
 * - comment lines directly above a removed or moved node go with it.
 */

import { Parser, escapeReference, stripComments } from 'links-notation';
import { elementLink } from '../format.js';
import { parse } from '../parse.js';
import { isAtom, valueLink } from '../links.js';
import { SourceIndexError, findElement, indexSource } from './index.js';
import { applyOpToTree, sameTree } from './ops.js';
import { QUOTES } from './scan.js';

/** An edit that cannot be made; reported as `{ ok: false, error }`. */
export class SourceEditError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceEditError';
  }
}

const isBlankChar = (c) => c === ' ' || c === '\t';
const isBreakChar = (c) => c === '\n' || c === '\r';

/** Split a text into lines, keeping no line breaks. */
const splitLines = (text) => {
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (isBreakChar(text[i])) {
      lines.push(text.slice(start, i));
      if (text[i] === '\r' && text[i + 1] === '\n') {
        i++;
      }
      start = i + 1;
    }
  }
  lines.push(text.slice(start));
  return lines;
};

/** Leading spaces and tabs of a line. */
const leadingBlanks = (line) => {
  let i = 0;
  while (i < line.length && isBlankChar(line[i])) {
    i++;
  }
  return line.slice(0, i);
};

/** Whether the text holds a `#` comment (as `stripComments` reads it). */
const hasComment = (text) => stripComments(text) !== text;

/** Whether the last line of a text ends in a comment. */
const endsInComment = (text) => {
  const lines = splitLines(text);
  return hasComment(lines[lines.length - 1]);
};

/** Whether `candidate` is read back as the reference `value`. */
function readsAs(candidate, value) {
  try {
    const [link] = new Parser().parse(`_: ${candidate}`);
    return (
      link.values.length === 1 &&
      isAtom(link.values[0]) &&
      link.values[0].id === value
    );
  } catch {
    return false;
  }
}

/**
 * Apply edits (in input offsets) to a text.
 * @param {string} text
 * @param {Array<{start:number,end:number,insert:string}>} edits
 * @returns {string}
 */
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let at = 0;
  for (const edit of sorted) {
    if (edit.start < at || edit.end < edit.start || edit.end > text.length) {
      throw new SourceEditError('The edits overlap');
    }
    out += text.slice(at, edit.start) + edit.insert;
    at = edit.end;
  }
  return out + text.slice(at);
}

/** Merge removals that overlap or touch into one. */
function mergeRemovals(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged.map(({ start, end }) => ({ start, end, insert: '' }));
}

/** The text, its span tree and the layout helpers of one edit. */
class Source {
  constructor(text, options) {
    this.text = text;
    this.options = options;
    this.index = indexSource(text, options);
    this.root = this.index.root;
    this.stripped = stripComments(text);
    this.eol = text.includes('\r\n') ? '\r\n' : '\n';
  }

  /* -- lines ------------------------------------------------------- */

  lineStart(pos) {
    let i = pos;
    while (i > 0 && !isBreakChar(this.text[i - 1])) {
      i--;
    }
    return i;
  }

  lineEnd(pos) {
    let i = pos;
    while (i < this.text.length && !isBreakChar(this.text[i])) {
      i++;
    }
    return i;
  }

  /** Length of the line break at `pos` (0 at the end of the text). */
  breakLength(pos) {
    if (this.text[pos] === '\r' && this.text[pos + 1] === '\n') {
      return 2;
    }
    return isBreakChar(this.text[pos]) ? 1 : 0;
  }

  /** Offset of the line break that ends the line before `lineStart`. */
  previousBreak(lineStart) {
    if (lineStart === 0) {
      return null;
    }
    const pair =
      this.text[lineStart - 2] === '\r' && this.text[lineStart - 1] === '\n';
    return lineStart - (pair ? 2 : 1);
  }

  /** Whether `[from, to)` holds only blanks and comments. */
  blankCode(from, to) {
    for (let i = from; i < to; i++) {
      if (!isBlankChar(this.stripped[i])) {
        return false;
      }
    }
    return true;
  }

  /** Whether the line from `lineStart` is a comment and nothing else. */
  commentLine(lineStart) {
    const end = this.lineEnd(lineStart);
    return (
      this.blankCode(lineStart, end) &&
      this.text.slice(lineStart, end).trim() !== ''
    );
  }

  /** Where a node starts with the comment lines directly above it. */
  attachedStart(node) {
    if (!node.startsLine) {
      return node.start;
    }
    let lineStart = this.lineStart(node.start);
    for (;;) {
      const previous = this.previousBreak(lineStart);
      if (previous === null) {
        break;
      }
      const start = this.lineStart(previous);
      if (!this.commentLine(start)) {
        break;
      }
      lineStart = start;
    }
    let first = lineStart;
    while (isBlankChar(this.text[first])) {
      first++;
    }
    return Math.min(first, node.start);
  }

  /** The end of a line when only blanks and a comment follow `pos`. */
  tailEnd(pos) {
    const end = this.lineEnd(pos);
    return this.blankCode(pos, end) ? end : pos;
  }

  /* -- nodes ------------------------------------------------------- */

  element(id) {
    const found = findElement(this.root, id);
    if (!found) {
      throw new SourceEditError(`No element "${id}"`);
    }
    return found;
  }

  parentSpan(parentId) {
    return parentId === null || parentId === undefined
      ? this.root
      : this.element(parentId).node;
  }

  /** The text of a node with its comments (above and trailing). */
  block(node) {
    const start = this.attachedStart(node);
    const end = node.startsLine ? this.tailEnd(node.end) : node.end;
    return this.text.slice(start, end).trimEnd();
  }

  /** The end of an element's head when it has nothing after it. */
  headEnd(node) {
    if (node.kind === 'document') {
      return this.text.length;
    }
    return Math.max(node.idSpan?.end ?? node.start, node.kindSpan?.end ?? 0);
  }

  /* -- values ------------------------------------------------------ */

  /** A reference, quoted like `old` (a value span) when possible. */
  atom(value, old) {
    const written = old ? this.text.slice(old.start, old.end) : '';
    const quote = QUOTES.includes(written[0]) ? written[0] : null;
    if (quote) {
      const candidate = quote + value.replaceAll(quote, quote + quote) + quote;
      if (readsAs(candidate, value)) {
        return candidate;
      }
    }
    return escapeReference(value);
  }

  value(value, old) {
    if (typeof value === 'string') {
      return this.atom(value, old);
    }
    return valueLink(value).format();
  }

  /* -- removal ----------------------------------------------------- */

  /** A node in the middle of a line: it and the blanks before it. */
  inlineRemoval(node) {
    let start = node.start;
    while (start > 0 && isBlankChar(this.text[start - 1])) {
      start--;
    }
    if (start < node.start && start > this.lineStart(node.start)) {
      return { start, end: node.end };
    }
    let end = node.end;
    while (isBlankChar(this.text[end])) {
      end++;
    }
    return { start: node.start, end };
  }

  /**
   * The text to delete to remove a node: its lines with the comments above
   * and after it when it owns them, otherwise the node and its blanks.
   */
  removal(node) {
    if (!node.startsLine) {
      return this.inlineRemoval(node);
    }
    const lineStart = this.lineStart(this.attachedStart(node));
    const end = this.lineEnd(node.end);
    const previous = this.previousBreak(lineStart);
    if (this.blankCode(node.end, end)) {
      // The node owns its lines.
      if (end < this.text.length) {
        return { start: lineStart, end: end + this.breakLength(end) };
      }
      return { start: previous ?? lineStart, end };
    }
    // Code (such as `)`) follows: join it to the line above.
    if (
      previous !== null &&
      !hasComment(this.text.slice(this.lineStart(previous), previous))
    ) {
      return { start: previous, end: node.end };
    }
    return {
      start: this.attachedStart(node),
      end: this.inlineRemoval(node).end,
    };
  }

  /* -- insertion --------------------------------------------------- */

  /** The indentation of a new line in `parent`, next to `sibling`. */
  childIndent(parent, sibling, skip) {
    if (sibling?.startsLine) {
      return sibling.indent;
    }
    const lined = parent.children.find((c) => c !== skip && c.startsLine);
    if (lined) {
      return lined.indent;
    }
    return parent.kind === 'document' ? '' : parent.indent + this.index.unit;
  }

  /** Whether an item added at the end of `parent` goes on a new line. */
  newlineIn(parent) {
    if (parent.kind === 'document' || parent.form !== 'inline') {
      return true;
    }
    return this.index.form !== 'inline' && parent.startsLine;
  }

  /**
   * The edit that inserts an item in `parent` before `before`, or at the
   * end (after `after`, or after the head). `render(mode, indent)` gives the
   * item's text: `mode` is `'inline'` or `'newline'`.
   */
  insertion(parent, { before, after }, render) {
    if (before) {
      if (before.startsLine) {
        const at = this.lineStart(this.attachedStart(before));
        const indent = before.indent;
        return {
          start: at,
          end: at,
          insert: indent + render('newline', indent) + this.eol,
        };
      }
      return {
        start: before.start,
        end: before.start,
        insert: `${render('inline')} `,
      };
    }
    if (!this.newlineIn(parent)) {
      const at = after ? after.end : this.headEnd(parent);
      return { start: at, end: at, insert: ` ${render('inline')}` };
    }
    const indent = this.childIndent(parent, after);
    if (!after && parent.kind === 'document') {
      const at = this.text.length;
      const lead = at > 0 && !isBreakChar(this.text[at - 1]) ? this.eol : '';
      return {
        start: at,
        end: at,
        insert: lead + indent + render('newline', indent) + this.eol,
      };
    }
    const at = this.tailEnd(after ? after.end : this.headEnd(parent));
    let insert = this.eol + indent + render('newline', indent);
    if (at < this.lineEnd(at) && endsInComment(insert)) {
      insert += this.eol + parent.indent;
    }
    return { start: at, end: at, insert };
  }

  /** Where a child element goes: before the `index`-th, or at the end. */
  childPlace(parent, index, skip) {
    const anchors = parent.children.filter(
      (c) => c.kind === 'element' && c !== skip
    );
    if (index < anchors.length) {
      return { before: anchors[index] };
    }
    const others = parent.children.filter((c) => c !== skip);
    return { after: anchors[anchors.length - 1] ?? others[others.length - 1] };
  }
}

/**
 * A text written for a new line: its first line as is, the next ones with
 * `oldIndent` replaced by `indent`.
 */
function reindent(text, oldIndent, indent, eol) {
  return splitLines(text)
    .map((line, i) => {
      if (i === 0 || line.trim() === '') {
        return i === 0 ? line : '';
      }
      return line.startsWith(oldIndent)
        ? indent + line.slice(oldIndent.length)
        : line;
    })
    .join(eol);
}

/**
 * A renderer for an element written as `text` (dedented, possibly over
 * several lines, possibly with comments). Inline it is one line: a
 * multi-line text is written again from the element as one link.
 */
function elementRenderer(source, text, oldIndent, node) {
  return (mode, indent) => {
    if (mode === 'newline') {
      return reindent(text, oldIndent, indent, source.eol);
    }
    if (hasComment(text)) {
      throw new SourceEditError(
        'The node has comments and cannot be written inline'
      );
    }
    return splitLines(text).length > 1 ? elementLink(node).format() : text;
  };
}

/* ------------------------------------------------------------------ */
/* Running and checking an edit.                                        */
/* ------------------------------------------------------------------ */

const SYNTAX = new Set(['syntax-error', 'depth-exceeded', 'input-too-large']);

/**
 * Check that `newText` parses to the tree `op` gives on the old document.
 * @returns {string|null} the error, or null when it does
 */
export function checkEdit(oldDocument, newText, op, options = {}) {
  const expected = applyOpToTree(oldDocument, op);
  if (!expected.ok) {
    return expected.error;
  }
  const actual = parse(newText, options);
  const syntax = actual.diagnostics.find((d) => SYNTAX.has(d.code));
  if (syntax) {
    return `The edited text does not parse: ${syntax.message}`;
  }
  if (!sameTree(actual, expected.tree)) {
    return 'The edited text does not give the expected tree';
  }
  return null;
}

/**
 * Index `text`, build the edits, apply them and check the result.
 * @param {string} text
 * @param {object} op the #16 op the edit stands for
 * @param {(source: Source) => { edits: object[], extra?: object }} build
 * @param {object} [options]
 */
function run(text, op, build, options = {}) {
  const fail = (error) => ({ ok: false, error, text });
  try {
    if (typeof text !== 'string') {
      return { ok: false, error: 'The input is not a string', text };
    }
    const source = new Source(text, options);
    const expected = applyOpToTree(source.index.document, op);
    if (!expected.ok) {
      return fail(expected.error);
    }
    const { edits, extra = {} } = build(source);
    const sorted = edits
      .filter((e) => e.start !== e.end || e.insert !== '')
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const next = applyEdits(text, sorted);
    const error = checkEdit(source.index.document, next, op, options);
    if (error) {
      return fail(error);
    }
    return { ok: true, text: next, edits: sorted, ...extra };
  } catch (error) {
    if (error instanceof SourceEditError || error instanceof SourceIndexError) {
      return fail(error.message);
    }
    throw error;
  }
}

/** The last property `name` of an element span that is not shadowed. */
const lastProp = (element, name) =>
  element.children
    .filter((c) => c.kind === 'prop' && c.name === name && !c.shadowed)
    .at(-1);

/* ------------------------------------------------------------------ */
/* The edits.                                                           */
/* ------------------------------------------------------------------ */

/**
 * Set the values of a property: the value span of its last occurrence is
 * replaced (nothing else changes); a missing property is added after the
 * last property, else before the first child, else at the end.
 * @param {string} text
 * @param {string} id
 * @param {string} name
 * @param {import('../types.js').RawValue[]} values
 * @param {object} [options] `{ vocabulary }`
 */
export function setProp(text, id, name, values, options) {
  const op = { op: 'setProp', id, name, values };
  return run(
    text,
    op,
    (source) => {
      const { node: element } = source.element(id);
      const prop = lastProp(element, name);
      if (prop) {
        const old = prop.children;
        const written = values.map((v, i) => source.value(v, old[i])).join(' ');
        if (old.length === 0) {
          const at = prop.nameSpan.end;
          return {
            edits: [
              { start: at, end: at, insert: written ? ` ${written}` : '' },
            ],
          };
        }
        const start = written ? old[0].start : prop.nameSpan.end;
        return {
          edits: [{ start, end: old[old.length - 1].end, insert: written }],
        };
      }
      const words = [
        escapeReference(name),
        ...values.map((v) => source.value(v)),
      ];
      const props = element.children.filter((c) => c.kind === 'prop');
      const sibling = props[props.length - 1];
      const lineStyle =
        element.form === 'indented' &&
        !(sibling && source.text[sibling.start] === '(');
      const item = lineStyle ? words.join(' ') : `(${words.join(' ')})`;
      const firstChild = element.children.find((c) => c.kind === 'element');
      const place = sibling
        ? { after: sibling }
        : firstChild
          ? { before: firstChild }
          : { after: element.children[element.children.length - 1] };
      const render = (mode) =>
        mode === 'inline' ? `(${words.join(' ')})` : item;
      return { edits: [source.insertion(element, place, render)] };
    },
    options
  );
}

/**
 * Remove every occurrence of a property (an earlier, shadowed one would
 * otherwise come back).
 */
export function removeProp(text, id, name, options) {
  const op = { op: 'removeProp', id, name };
  return run(
    text,
    op,
    (source) => {
      const { node: element } = source.element(id);
      const props = element.children.filter(
        (c) => c.kind === 'prop' && c.name === name
      );
      return { edits: mergeRemovals(props.map((p) => source.removal(p))) };
    },
    options
  );
}

/**
 * Set the positional values of an element (the references after its kind).
 * @param {string} text
 * @param {string} id
 * @param {string[]} values
 */
export function setPositional(text, id, values, options) {
  const op = { op: 'setPositional', id, values };
  return run(
    text,
    op,
    (source) => {
      const { node: element } = source.element(id);
      const old = element.children.filter((c) => c.role === 'positional');
      const written = values.map((v, i) => source.atom(v, old[i])).join(' ');
      if (old.length === 0) {
        const at = element.kindSpan.end;
        return {
          edits: written ? [{ start: at, end: at, insert: ` ${written}` }] : [],
        };
      }
      const [first, ...rest] = old;
      const edits = rest.map((v) => ({
        ...source.inlineRemoval(v),
        insert: '',
      }));
      edits.push(
        written
          ? { start: first.start, end: first.end, insert: written }
          : { ...source.inlineRemoval(first), insert: '' }
      );
      return { edits };
    },
    options
  );
}

/** A child given as Links Notation text, dedented, and the element it is. */
function readChild(childLino, options) {
  if (typeof childLino !== 'string') {
    throw new SourceEditError('The child is not a string');
  }
  const document = parse(childLino, options);
  const errors = document.diagnostics.filter((d) => SYNTAX.has(d.code));
  if (
    errors.length > 0 ||
    document.roots.length !== 1 ||
    document.unknown.length > 0
  ) {
    throw new SourceEditError('The child text must be exactly one element');
  }
  const lines = splitLines(childLino);
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  const indent = leadingBlanks(lines[0]);
  lines[0] = lines[0].slice(indent.length);
  return {
    node: document.roots[0],
    text: lines.map((l) => l.trimEnd()).join('\n'),
    indent,
  };
}

/**
 * Insert a child element, given as Links Notation text, at `index` among
 * the child elements of `parentId` (`null`: a new root).
 */
export function insertChild(text, parentId, index, childLino, options) {
  let child;
  try {
    child = readChild(childLino, options);
  } catch (error) {
    return { ok: false, error: error.message, text };
  }
  const op = { op: 'insert', parentId, index, node: child.node };
  return run(
    text,
    op,
    (source) => {
      const parent = source.parentSpan(parentId);
      const render = elementRenderer(
        source,
        child.text,
        child.indent,
        child.node
      );
      return {
        edits: [
          source.insertion(parent, source.childPlace(parent, index), render),
        ],
      };
    },
    options
  );
}

/** Remove an element with its lines and the comments above it. */
export function removeNode(text, id, options) {
  return run(
    text,
    { op: 'remove', id },
    (source) => {
      const { node } = source.element(id);
      return { edits: [{ ...source.removal(node), insert: '' }] };
    },
    options
  );
}

/**
 * Move an element (with its comments) to `index` among the child elements
 * of `parentId` (`null`: the roots). `index` counts without the node.
 */
export function moveNode(text, id, parentId, index, options) {
  const op = { op: 'move', id, parentId, index };
  return run(
    text,
    op,
    (source) => {
      const { node } = source.element(id);
      const parent = source.parentSpan(parentId);
      const block = source.block(node);
      const render = elementRenderer(source, block, node.indent, node.node);
      const removal = { ...source.removal(node), insert: '' };
      const insertion = source.insertion(
        parent,
        source.childPlace(parent, index, node),
        render
      );
      if (insertion.start > removal.start && insertion.start < removal.end) {
        throw new SourceEditError('The node cannot be moved into itself');
      }
      return { edits: [removal, insertion] };
    },
    options
  );
}

/** Every reference span of a span tree whose text is `id`. */
function referencesTo(node, id, found = []) {
  if (node.kind === 'value' && node.text === id) {
    found.push({ start: node.start, end: node.end });
  }
  for (const child of node.children) {
    referencesTo(child, id, found);
  }
  return found;
}

/**
 * Rename an element: only its definition changes. `references` lists the
 * other references with the old id (in offsets of the new text), for the
 * caller to decide on.
 */
export function renameId(text, from, to, options) {
  return run(
    text,
    { op: 'rename', id: from, to },
    (source) => {
      const { node } = source.element(from);
      const span = node.idSpan;
      const insert = source.atom(to, span);
      const delta = insert.length - (span.end - span.start);
      const references = referencesTo(source.root, from).map(
        ({ start, end }) =>
          start >= span.end
            ? { start: start + delta, end: end + delta }
            : { start, end }
      );
      return {
        edits: [{ start: span.start, end: span.end, insert }],
        extra: { references },
      };
    },
    options
  );
}
