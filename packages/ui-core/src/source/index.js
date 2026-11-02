/**
 * `indexSource(text)`: the span tree of a UI document. Every element,
 * property and value of the `parse(text)` tree is mapped to the `{ start,
 * end }` offsets of the text it was read from, in all three document forms.
 *
 * Structure is never guessed. The delimiters found by `scan.js` are grouped
 * into lines and parenthesised groups, and every span is then checked against
 * the official `links-notation` parser: the text of the span, parsed on its
 * own, must give a link that `.equals()` the link at the same path of the
 * whole document, and the tree projected from those links must deep-equal
 * `parse(text)`. Any mismatch throws a `SourceIndexError` naming the path.
 *
 * Stopgap: when `links-notation` reports source positions (see the upstream
 * proposal in the README), this module uses them and `scan.js` is deleted.
 */

import { Link, Parser, stripComments } from 'links-notation';
import { parse } from '../parse.js';
import { Projector } from '../project.js';
import { isAtom, isPathLink, linkKey } from '../links.js';
import { defaultVocabulary } from '../vocabulary.js';
import { scanDelimiters } from './scan.js';

/**
 * @typedef {object} Span
 * @property {number} start
 * @property {number} end
 *
 * @typedef {object} SpanNode
 * @property {number} start
 * @property {number} end
 * @property {'document'|'element'|'prop'|'value'} kind
 * @property {string|null} [id]        elements: the id (`null` if anonymous)
 * @property {string} [name]           props: the property name
 * @property {'positional'|'value'|'unknown'} [role]  values only
 * @property {SpanNode[]} children     in source order
 * @property {string} [indent]         the spaces that start the node's line
 * @property {boolean} [startsLine]    nothing but blanks before it on its line
 * @property {'inline'|'multiline'|'indented'} [form]  elements only
 * @property {Span} [idSpan]           elements: the id before `:`
 * @property {Span} [kindSpan]         elements: the kind
 * @property {Span} [nameSpan]         props: the property name
 * @property {boolean} [shadowed]      props: an earlier duplicate (last wins)
 * @property {string} [text]           atoms: the value read from the span
 * @property {object} [node]           elements: the UiNode (not enumerable)
 */

/** Thrown when a span cannot be confirmed by the official parser. */
export class SourceIndexError extends Error {
  /**
   * @param {string} message
   * @param {string} [path] where the mismatch was found, e.g. `0.3.1`
   */
  constructor(message, path) {
    super(path === undefined ? message : `${message} (at ${path})`);
    this.name = 'SourceIndexError';
    this.path = path;
  }
}

/* ------------------------------------------------------------------ */
/* Syntax: lines and groups built from the scanned delimiters.         */
/* ------------------------------------------------------------------ */

/**
 * Read the tokens into lines. A context (the document or a group) is a list
 * of lines; a line is an optional `id:` and items (references and groups);
 * lines indented deeper than the line above are its children.
 */
class Reader {
  constructor(text, stripped, tokens) {
    this.text = text;
    this.stripped = stripped;
    this.tokens = tokens;
    this.at = 0;
  }

  fail(message, offset) {
    throw new SourceIndexError(`${message} at offset ${offset}`);
  }

  peek() {
    return this.tokens[this.at];
  }

  /** Spaces before `offset` back to a line break, `(` or the start. */
  indentOf(offset) {
    let i = offset;
    while (i > 0 && this.stripped[i - 1] === ' ') {
      i--;
    }
    const before = this.stripped[i - 1];
    if (i === 0 || before === '\n' || before === '\r' || before === '(') {
      return offset - i;
    }
    return -1;
  }

  /** Read the lines of one context, up to `)` (in a group) or the end. */
  readContext(inGroup) {
    const flat = [];
    for (;;) {
      const token = this.peek();
      if (!token) {
        if (inGroup) {
          this.fail('Unclosed parenthesis', this.text.length);
        }
        break;
      }
      if (token.type === 'close') {
        if (!inGroup) {
          this.fail('Unmatched closing parenthesis', token.start);
        }
        break;
      }
      if (token.type === 'break') {
        this.at++;
        continue;
      }
      flat.push(this.readLine());
    }
    return nestByIndent(flat);
  }

  readLine() {
    const first = this.peek();
    const line = {
      type: 'line',
      start: first.start,
      end: first.start,
      indent: this.indentOf(first.start),
      id: null,
      items: [],
      children: [],
    };
    if (line.indent < 0) {
      this.fail('Unsupported indentation', first.start);
    }
    const second = this.tokens[this.at + 1];
    if (first.type === 'reference' && second?.type === 'colon') {
      line.id = this.reference(first);
      line.colonEnd = second.end;
      line.end = second.end;
      this.at += 2;
    }
    for (;;) {
      const token = this.peek();
      if (!token || token.type === 'break' || token.type === 'close') {
        break;
      }
      if (token.type === 'colon') {
        this.fail('Unexpected colon', token.start);
      }
      const item =
        token.type === 'open' ? this.readGroup() : this.readReference();
      line.items.push(item);
      line.end = item.end;
    }
    return line;
  }

  reference(token) {
    return {
      type: 'reference',
      start: token.start,
      end: token.end,
      quoted: token.quoted,
    };
  }

  readReference() {
    const token = this.peek();
    this.at++;
    return this.reference(token);
  }

  readGroup() {
    const open = this.peek();
    this.at++;
    const lines = this.readContext(true);
    const close = this.peek();
    this.at++;
    return { type: 'group', start: open.start, end: close.end, lines };
  }
}

/** Nest a flat list of lines by indentation: deeper lines are children. */
function nestByIndent(flat) {
  const top = [];
  const stack = [];
  for (const line of flat) {
    while (stack.length > 0 && stack[stack.length - 1].indent >= line.indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      top.push(line);
    } else {
      stack[stack.length - 1].children.push(line);
    }
    stack.push(line);
  }
  for (const line of flat) {
    if (line.children.length > 0) {
      line.end = line.children[line.children.length - 1].end;
    }
  }
  // Ends of nested children are final only after the inner lines are set.
  const fix = (line) => {
    line.children.forEach(fix);
    if (line.children.length > 0) {
      line.end = line.children[line.children.length - 1].end;
    }
  };
  top.forEach(fix);
  return top;
}

/* ------------------------------------------------------------------ */
/* Links: the link every syntax node stands for, with the value spans.  */
/* ------------------------------------------------------------------ */

/**
 * Builds a `Link` for every line, group and reference, in the folded form
 * `ui-core` projects (`(id: values... children...)`), and remembers the span
 * of each link and of each of its values.
 */
class Linker {
  constructor(text, stripped) {
    this.text = text;
    this.stripped = stripped;
    /** @type {Map<Link, object>} link -> { start, end, values: Span[], ... } */
    this.info = new Map();
  }

  record(link, info) {
    this.info.set(link, info);
    return link;
  }

  /** The text a reference stands for, read by the official parser. */
  atom(item) {
    const slice = this.text.slice(item.start, item.end);
    const [link] = new Parser().parse(`_: ${slice}`);
    const value = link?.values?.[0];
    if (!value || !isAtom(value) || link.values.length !== 1) {
      throw new SourceIndexError(
        `Reference "${slice}" is not one reference`,
        String(item.start)
      );
    }
    const atom = new Link(value.id);
    return this.record(atom, {
      start: item.start,
      end: item.end,
      values: [],
      item,
    });
  }

  item(item) {
    return item.type === 'group' ? this.group(item) : this.atom(item);
  }

  /** A line with its indented children folded in, as `unindent` does. */
  line(line) {
    const items = line.items.map((item) => this.item(item));
    const spans = line.items.map(({ start, end }) => ({ start, end }));
    const children = line.children.map((child) => this.line(child));
    let base;
    let baseSpans;
    if (
      line.id === null &&
      items.length === 1 &&
      line.items[0].type === 'group'
    ) {
      // A line that is one group is that group's link.
      base = items[0];
      baseSpans = this.info.get(base).values;
    } else {
      const id = line.id === null ? null : this.atom(line.id).id;
      base = new Link(id, items);
      baseSpans = spans;
    }
    const link =
      children.length > 0
        ? new Link(base.id, [...base.values, ...children])
        : base;
    const info = {
      start: line.start,
      end: line.end,
      values: [
        ...baseSpans,
        ...line.children.map(({ start, end }) => ({ start, end })),
      ],
      line,
      isLine: !(
        line.id === null &&
        items.length === 1 &&
        line.items[0].type === 'group' &&
        children.length === 0
      ),
    };
    if (line.id !== null) {
      info.idSpan = { start: line.id.start, end: line.id.end };
    }
    if (base !== link || !this.info.has(link)) {
      this.record(link, info);
    } else {
      // A line that is one group: keep the group span, note the line.
      this.info.get(link).line = line;
    }
    return link;
  }

  /**
   * A parenthesised group. With one line it is that line's link (the
   * multi-line form folded); with several lines a link of their links.
   */
  group(group) {
    let link;
    let values;
    let idSpan;
    if (group.lines.length === 1) {
      const [only] = group.lines;
      const single =
        only.id === null &&
        only.items.length === 1 &&
        only.items[0].type === 'group' &&
        only.children.length === 0;
      link = this.line(only);
      const inner = this.info.get(link);
      if (single) {
        // `((a b))`: a group around one group is a link of that link.
        link = new Link(null, [link]);
        values = [{ start: inner.start, end: inner.end }];
      } else {
        values = inner.values;
        idSpan = inner.idSpan;
      }
    } else {
      const lines = group.lines.map((line) => this.line(line));
      link = new Link(null, lines);
      values = group.lines.map(({ start, end }) => ({ start, end }));
    }
    const info = {
      start: group.start,
      end: group.end,
      values,
      group,
      isLine: false,
    };
    if (idSpan) {
      info.idSpan = idSpan;
    }
    this.info.set(link, info);
    return link;
  }
}

/* ------------------------------------------------------------------ */
/* The official parse, normalised to the same folded form.              */
/* ------------------------------------------------------------------ */

/** A group of `Parser.parseGroups()` as one link (as `parse` does). */
function unindent(group) {
  const { element, children } = group;
  return children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
}

/**
 * Fold the path links the parser returns for a multi-line group back into
 * one link: `(H (H a) ((H a) b) (H c))` -> `(H... (a... b) c)`. A link that
 * is not such a group is normalised value by value.
 * @param {Link} link
 * @returns {Link}
 */
export function normalizeLink(link) {
  if (isAtom(link)) {
    return link;
  }
  const folded = foldGroup(link);
  if (folded) {
    return folded;
  }
  return new Link(link.id, link.values.map(normalizeLink));
}

function foldGroup(link) {
  const [head, ...rest] = link.values;
  if (link.id !== null || rest.length === 0 || isPathLink(head)) {
    return null;
  }
  const root = { link: head, extra: [] };
  const byKey = new Map([[linkKey(head), root]]);
  for (const value of rest) {
    if (!isPathLink(value) || value.values.length !== 2) {
      return null;
    }
    const [path, payload] = value.values;
    const target = byKey.get(linkKey(path));
    if (!target) {
      return null;
    }
    const node = { link: payload, extra: [] };
    target.extra.push(node);
    byKey.set(linkKey(value), node);
  }
  const build = ({ link: base, extra }) => {
    const normal = normalizeLink(base);
    return extra.length === 0
      ? normal
      : new Link(normal.id, [...normal.values, ...extra.map(build)]);
  };
  return build(root);
}

/** The official links of a text, read as `parse` reads them, normalised. */
function officialLinks(text) {
  return new Parser().parseGroups(text).map(unindent).map(normalizeLink);
}

/* ------------------------------------------------------------------ */
/* Projection: which link became which element, property or value.      */
/* ------------------------------------------------------------------ */

class RecordingProjector extends Projector {
  constructor(vocabulary) {
    super(vocabulary);
    this.elements = new Map(); // link -> UiNode
    this.props = new Map(); // link -> UiProperty
    this.owners = new Map(); // UiProperty -> UiNode
  }

  /**
   * A path link that folds into an earlier node would give one node text in
   * two places, so it is refused; one kept verbatim is an ordinary value.
   */
  place(frame, link) {
    if (!isPathLink(link)) {
      return super.place(frame, link);
    }
    const verbatim = this.verbatim;
    this.verbatim = null;
    const result = super.place(frame, link);
    const kept = this.verbatim === link;
    this.verbatim = verbatim;
    if (!kept) {
      throw new SourceIndexError(
        `Path links that fold (${link.format()}) are not supported by source edits`
      );
    }
    return result;
  }

  keepVerbatim(frame, link) {
    this.verbatim = link;
    return super.keepVerbatim(frame, link);
  }

  addElement(frame, link, id) {
    const child = super.addElement(frame, link, id);
    this.elements.set(link, child.node);
    return child;
  }

  addProperty(frame, link, name, spec) {
    const result = super.addProperty(frame, link, name, spec);
    const { properties } = frame.node;
    const property = properties[properties.length - 1];
    this.props.set(link, property);
    this.owners.set(property, frame.node);
    return result;
  }
}

/* ------------------------------------------------------------------ */
/* The span tree.                                                       */
/* ------------------------------------------------------------------ */

const shape = (doc) =>
  JSON.stringify({ roots: doc.roots, unknown: doc.unknown });

function lineInfo(text, offset) {
  let start = offset;
  while (start > 0 && text[start - 1] !== '\n' && text[start - 1] !== '\r') {
    start--;
  }
  let i = start;
  while (i < offset && (text[i] === ' ' || text[i] === '\t')) {
    i++;
  }
  return { indent: text.slice(start, i), startsLine: i === offset };
}

class SpanBuilder {
  constructor(text, linker, projector) {
    this.text = text;
    this.linker = linker;
    this.projector = projector;
  }

  base(kind, span, extra) {
    const { indent, startsLine } = lineInfo(this.text, span.start);
    return {
      start: span.start,
      end: span.end,
      kind,
      ...extra,
      children: [],
      indent,
      startsLine,
    };
  }

  form(info) {
    if (info.group === undefined) {
      return 'indented';
    }
    const slice = this.text.slice(info.start, info.end);
    return slice.includes('\n') || slice.includes('\r')
      ? 'multiline'
      : 'inline';
  }

  element(link, span) {
    const node = this.projector.elements.get(link);
    const info = this.linker.info.get(link);
    const result = this.base('element', span, {
      id: node.id,
      form: this.form(info),
    });
    Object.defineProperty(result, 'node', { value: node, enumerable: false });
    if (info.idSpan) {
      result.idSpan = info.idSpan;
    }
    link.values.forEach((value, index) => {
      const valueSpan = info.values[index];
      if (index === 0 && node.kind !== null) {
        result.kindSpan = { start: valueSpan.start, end: valueSpan.end };
        return;
      }
      result.children.push(this.child(value, valueSpan, index === 0));
    });
    return result;
  }

  child(link, span, first) {
    if (this.projector.elements.has(link)) {
      return this.element(link, span);
    }
    const prop = this.projector.props.get(link);
    if (prop) {
      return this.prop(link, span, prop);
    }
    return this.value(
      link,
      span,
      isAtom(link) && !first ? 'positional' : 'unknown'
    );
  }

  prop(link, span, prop) {
    const info = this.linker.info.get(link);
    const result = this.base('prop', span, { name: prop.name });
    const element = this.ownerOf(prop);
    if (element && !element.properties.includes(prop)) {
      result.shadowed = true;
    }
    result.nameSpan = { ...info.values[0] };
    link.values.slice(1).forEach((value, index) => {
      result.children.push(this.value(value, info.values[index + 1], 'value'));
    });
    return result;
  }

  ownerOf(prop) {
    return this.projector.owners.get(prop);
  }

  value(link, span, role) {
    const result = this.base('value', span, { role });
    if (isAtom(link)) {
      result.text = link.id;
      return result;
    }
    const info = this.linker.info.get(link);
    link.values.forEach((value, index) => {
      result.children.push(this.value(value, info.values[index], 'value'));
    });
    return result;
  }
}

/** `path` of a value inside the document links, e.g. `0.3.1`. */
function checkSpans(text, links, linker) {
  const parser = new Parser();
  const visit = (link, path) => {
    const info = linker.info.get(link);
    if (!info) {
      throw new SourceIndexError('A link has no span', path);
    }
    const slice = text.slice(info.start, info.end);
    let again;
    try {
      if (info.isLine) {
        const read = parser.parseGroups(slice).map(unindent).map(normalizeLink);
        again = read.length === 1 ? read[0] : null;
      } else {
        const [wrapped] = parser.parse(`_: ${slice}`);
        again =
          wrapped && wrapped.values.length === 1
            ? normalizeLink(wrapped.values[0])
            : null;
      }
    } catch (error) {
      throw new SourceIndexError(
        `The span text does not parse: ${error.message}`,
        path
      );
    }
    if (!again || !again.equals(link)) {
      throw new SourceIndexError(
        `The span text "${slice}" does not read back as ${link.format()}`,
        path
      );
    }
    link.values.forEach((value, index) => visit(value, `${path}.${index}`));
  };
  links.forEach((link, index) => visit(link, String(index)));
}

/**
 * The span tree of a UI document.
 * @param {string} text
 * @param {{ vocabulary?: import('../types.js').Vocabulary }} [options]
 * @returns {{ root: SpanNode, form: 'inline'|'multiline'|'indented',
 *   document: import('../types.js').UiDocument, unit: string }}
 * @throws {SourceIndexError} when a span cannot be confirmed
 */
export function indexSource(text, options = {}) {
  if (typeof text !== 'string') {
    throw new SourceIndexError('The input is not a string');
  }
  const vocabulary = options.vocabulary ?? defaultVocabulary();
  const document = parse(text, { vocabulary });
  const parserError = document.diagnostics.find(
    (d) =>
      d.code === 'syntax-error' ||
      d.code === 'depth-exceeded' ||
      d.code === 'input-too-large'
  );
  if (parserError) {
    throw new SourceIndexError(
      `The text does not parse: ${parserError.message}`
    );
  }
  const stripped = stripComments(text);
  const { tokens, indents } = scanDelimiters(stripped);
  const lines = new Reader(text, stripped, tokens).readContext(false);
  const linker = new Linker(text, stripped);
  const links = lines.map((line) => linker.line(line));

  // 1. The whole document: our links equal the official ones.
  const official = officialLinks(text);
  if (official.length !== links.length) {
    throw new SourceIndexError(
      `Expected ${official.length} top-level links, found ${links.length}`
    );
  }
  links.forEach((link, index) => {
    if (!link.equals(official[index])) {
      throw new SourceIndexError(
        `Link ${link.format()} differs from the parser's ${official[index].format()}`,
        String(index)
      );
    }
  });
  // 2. Every span parses on its own to the link at the same path.
  checkSpans(text, links, linker);
  // 3. The projection of our links is the tree of `parse(text)`.
  const projector = new RecordingProjector(vocabulary);
  links.forEach((link) => projector.top(link));
  const projected = projector.result();
  if (shape(projected) !== shape(document)) {
    throw new SourceIndexError('The projected tree differs from parse(text)');
  }

  const builder = new SpanBuilder(text, linker, projector);
  const root = {
    start: 0,
    end: text.length,
    kind: 'document',
    children: links.map((link) => {
      const { start, end } = linker.info.get(link);
      return builder.child(link, { start, end }, false);
    }),
    indent: '',
    startsLine: true,
  };
  for (const child of root.children) {
    if (child.kind === 'value') {
      child.role = 'unknown';
    }
  }
  const firstElement = root.children.find((c) => c.kind === 'element');
  return {
    root,
    form: firstElement?.form ?? 'multiline',
    document,
    unit: indentUnit(indents),
  };
}

/** The smallest indentation used in the text, two spaces by default. */
function indentUnit(indents) {
  let unit = 0;
  for (const indent of indents) {
    if (indent > 0 && (unit === 0 || indent < unit)) {
      unit = indent;
    }
  }
  return ' '.repeat(unit || 2);
}

/**
 * Find the first element (in document order) with an id.
 * @param {SpanNode} root
 * @param {string} id
 * @returns {{ node: SpanNode, parent: SpanNode } | null}
 */
export function findElement(root, id) {
  for (const child of root.children) {
    if (child.kind !== 'element') {
      continue;
    }
    if (child.id === id) {
      return { node: child, parent: root };
    }
    const found = findElement(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}
