#!/usr/bin/env node
/**
 * Rewrite Links Notation files (and the ```lino blocks of Markdown files)
 * in the nested form (#133): the indented form where every value that is
 * itself a link with values goes on its own line under its parent, and the
 * parentheses that indentation makes unneeded are left out.
 *
 *   node scripts/lino-nest.mjs <file.lino|file.md>...          # rewrite
 *   node scripts/lino-nest.mjs --check <file.lino|file.md>...  # exit 1 when a file would change
 *   node scripts/lino-nest.mjs --verbose ...                   # also trace every group
 *
 * `--verbose` (or `LINO_NEST_DEBUG=1`) writes one line per group of lines to
 * stderr: whether it was nested, already nested or kept, and the values it
 * read. It is off by default; use it to see why a file is (not) rewritten.
 *
 * Text is read only by the official `links-notation` parser (through
 * `parseNested` of ui-core) and written by `formatLinks` of ui-core. Each
 * group of lines between blank lines is converted on its own, so the blank
 * lines of a file stay. A link written over several lines in parentheses
 * reads as path links (`(a: b\n  (c d))` reads as `(a: b) ((a: b) (c d))`);
 * they are folded back into one link before writing.
 *
 * A group is left as it is, with a note on stderr, when it does not parse,
 * when it holds a line comment, or when the nested text would not read back
 * as the same links. A group already in the nested form (the same lines as
 * the formatter writes, only quoted or spaced differently) is kept as
 * written; elsewhere a reference keeps the quoting it was written with.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { formatLinks, parseLinks } from '../packages/ui-core/src/index.js';
import { indexSource } from '../packages/ui-core/src/source.js';

const isLink = (value) => typeof value !== 'string';
const parts = (value) => (Array.isArray(value) ? value : value.values);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** `value` with the extra `values` appended. */
const withValues = (value, values) =>
  Array.isArray(value)
    ? [...value, ...values]
    : { id: value.id, values: [...value.values, ...values] };

/**
 * The values of one continuation line `(H x)` of a multi-line link. A line
 * with several links, `(a 1) (b 2)`, reads as one list of links; its
 * readers (ui-settings `lineValues`) take each link as a value of its own.
 */
function lineValues(item) {
  const line = item[1];
  const several =
    Array.isArray(line) &&
    line.length > 1 &&
    line.every(isLink) &&
    !isPath(line);
  return several ? line.map(fold) : [fold(line)];
}

/** Whether a value is a path group `(H (H a) (H b))` with a link `H`. */
function isPath(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  const [head, ...rest] = value;
  return (
    head !== undefined &&
    isLink(head) &&
    rest.length > 0 &&
    rest.every(
      (item) => Array.isArray(item) && item.length === 2 && same(item[0], head)
    )
  );
}

/**
 * Fold the path links of the multi-line parenthesized form,
 * `(H (H a) (H b))` with a head `H` that is a link, back into `H` with the
 * values `a b`; the rest of the value is folded the same way.
 */
export function fold(value) {
  if (!isLink(value)) {
    return value;
  }
  const values = parts(value);
  if (isPath(value)) {
    const [head, ...rest] = values;
    return withValues(fold(head), rest.flatMap(lineValues));
  }
  const folded = values.map(fold);
  return Array.isArray(value) ? folded : { id: value.id, values: folded };
}

const unlimited = { maxDepth: Infinity, maxInputSize: Infinity };

/**
 * The shape of a text's lines: the indentation of each line and whether it
 * opens with a parenthesis. Two texts with the same layout differ only
 * inside their lines (quoting, spacing).
 */
export function layout(text) {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(
      (line) =>
        `${line.length - line.trimStart().length}${line.trimStart()[0] === '(' ? '(' : ''}`
    )
    .join(' ');
}

/** Every reference span of a text: `{ text, start, end }`. */
function references(text) {
  const found = [];
  const visit = (span) => {
    if (span.kind === 'value' && typeof span.text === 'string') {
      found.push(span);
    }
    span.children?.forEach(visit);
  };
  try {
    visit(indexSource(text, unlimited).root);
  } catch {
    // Not indexed: the formatter's quoting stays.
  }
  return found;
}

/**
 * `nested` with every reference spelled as in `original` (`'OK'` stays
 * quoted): reference by reference when both write the same references in
 * the same order, otherwise for the references the original spells one way
 * only.
 */
function respell(original, nested) {
  const from = references(original);
  const to = references(nested);
  const spelled = (span) => original.slice(span.start, span.end);
  let spelling;
  if (
    same(
      from.map((r) => r.text),
      to.map((r) => r.text)
    )
  ) {
    spelling = (span, i) => spelled(from[i]);
  } else {
    const spellings = new Map();
    for (const span of from) {
      spellings.set(
        span.text,
        (spellings.get(span.text) ?? new Set()).add(spelled(span))
      );
    }
    spelling = (span) => {
      const set = spellings.get(span.text);
      return set?.size === 1 ? [...set][0] : null;
    };
  }
  let out = nested;
  for (let i = to.length - 1; i >= 0; i--) {
    const written = spelling(to[i], i);
    if (written !== null) {
      out = out.slice(0, to[i].start) + written + out.slice(to[i].end);
    }
  }
  return out;
}

/**
 * The nested text of one group of lines, or `null` when it is kept as it
 * is (with the reason).
 * @param {string} text
 * @returns {{ text: string } | { reason: string }}
 */
export function nestGroup(text) {
  if (/^\s*(#|\/\/)/mu.test(text)) {
    return { reason: 'it holds a comment line' };
  }
  let values;
  try {
    values = parseLinks(text, unlimited).map(fold);
  } catch (error) {
    return { reason: `it does not parse: ${error.message}` };
  }
  const nested = respell(text, formatLinks(values));
  if (!same(parseLinks(nested, unlimited), values)) {
    return { reason: 'the nested form would read differently' };
  }
  // Already nested (the same lines, only quoted differently): kept as written.
  if (layout(nested) === layout(text)) {
    return { text };
  }
  return { text: nested };
}

/**
 * The nested text of a whole LiNo text: each group between blank lines on
 * its own.
 * @param {string} text
 * @param {(reason: string, group: string) => void} [note] told why a group is kept
 * @param {(status: string, group: string) => void} [trace] told about every group (debug)
 */
export function nestLino(text, note = () => {}, trace = () => {}) {
  const groups = text.replace(/\n+$/u, '').split(/\n[ \t]*\n/u);
  return `${groups
    .map((group) => {
      if (group.trim() === '') {
        return group;
      }
      const result = nestGroup(group);
      if ('reason' in result) {
        note(result.reason, group);
        trace(`kept (${result.reason})`, group);
        return group;
      }
      trace(result.text === group ? 'already nested' : 'nested', group);
      return result.text.replace(/\n$/u, '');
    })
    .join('\n\n')}\n`;
}

const FENCE =
  /^(?<indent>[ \t]*)```lino[ \t]*\n(?<body>[\s\S]*?)^\k<indent>```[ \t]*$/gmu;

/** The text of a Markdown file with its ```lino blocks nested. */
export function nestMarkdown(text, note = () => {}, trace = () => {}) {
  return text.replace(FENCE, (block, indent, body) => {
    const lines = body.split('\n').map((line) => line.slice(indent.length));
    const nested = nestLino(lines.join('\n'), note, trace).replace(/\n$/u, '');
    const indented = nested
      .split('\n')
      .map((line) => (line === '' ? '' : `${indent}${line}`))
      .join('\n');
    return `${indent}\`\`\`lino\n${indented}\n${indent}\`\`\``;
  });
}

/** The values a group reads as, for the debug trace. */
function traceValues(group) {
  try {
    return JSON.stringify(parseLinks(group, unlimited).map(fold));
  } catch (error) {
    return error.message;
  }
}

function main(argv) {
  const check = argv.includes('--check');
  const verbose =
    argv.includes('--verbose') || process.env.LINO_NEST_DEBUG === '1';
  const files = argv.filter((arg) => arg !== '--check' && arg !== '--verbose');
  let changed = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const note = (reason, group) =>
      console.error(
        `${file}: kept as written, ${reason}: ${group.split('\n')[0]}`
      );
    const trace = verbose
      ? (status, group) =>
          console.error(
            `${file}: ${status}: ${group.split('\n')[0]} -> ${traceValues(group)}`
          )
      : undefined;
    const nested = file.endsWith('.md')
      ? nestMarkdown(text, note, trace)
      : nestLino(text, note, trace);
    if (nested !== text) {
      changed++;
      if (check) {
        console.error(`${file} is not in the nested form`);
      } else {
        writeFileSync(file, nested);
      }
    }
  }
  return check && changed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
