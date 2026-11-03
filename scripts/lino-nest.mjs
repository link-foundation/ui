#!/usr/bin/env node
/**
 * Rewrite Links Notation files (and the ```lino blocks of Markdown files)
 * in the nested form (#133): the indented form where every value that is
 * itself a link with values goes on its own line under its parent, and the
 * parentheses that indentation makes unneeded are left out.
 *
 *   node scripts/lino-nest.mjs <file.lino|file.md>...          # rewrite
 *   node scripts/lino-nest.mjs --check <file.lino|file.md>...  # exit 1 when a file would change
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
 * as the same links.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { formatLinks, parseLinks } from '../packages/ui-core/src/index.js';

const isLink = (value) => typeof value !== 'string';
const parts = (value) => (Array.isArray(value) ? value : value.values);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** `value` with the extra `values` appended. */
const withValues = (value, values) =>
  Array.isArray(value)
    ? [...value, ...values]
    : { id: value.id, values: [...value.values, ...values] };

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
  const [head, ...rest] = values;
  const path =
    Array.isArray(value) &&
    head !== undefined &&
    isLink(head) &&
    rest.length > 0 &&
    rest.every(
      (item) => Array.isArray(item) && item.length === 2 && same(item[0], head)
    );
  if (path) {
    return withValues(
      fold(head),
      rest.map((item) => fold(item[1]))
    );
  }
  const folded = values.map(fold);
  return Array.isArray(value) ? folded : { id: value.id, values: folded };
}

const unlimited = { maxDepth: Infinity, maxInputSize: Infinity };

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
  const nested = formatLinks(values);
  if (!same(parseLinks(nested, unlimited), values)) {
    return { reason: 'the nested form would read differently' };
  }
  return { text: nested };
}

/**
 * The nested text of a whole LiNo text: each group between blank lines on
 * its own.
 * @param {string} text
 * @param {(reason: string, group: string) => void} [note]
 */
export function nestLino(text, note = () => {}) {
  const groups = text.replace(/\n+$/u, '').split(/\n[ \t]*\n/u);
  return `${groups
    .map((group) => {
      if (group.trim() === '') {
        return group;
      }
      const result = nestGroup(group);
      if ('reason' in result) {
        note(result.reason, group);
        return group;
      }
      return result.text.replace(/\n$/u, '');
    })
    .join('\n\n')}\n`;
}

const FENCE =
  /^(?<indent>[ \t]*)```lino[ \t]*\n(?<body>[\s\S]*?)^\k<indent>```[ \t]*$/gmu;

/** The text of a Markdown file with its ```lino blocks nested. */
export function nestMarkdown(text, note = () => {}) {
  return text.replace(FENCE, (block, indent, body) => {
    const lines = body.split('\n').map((line) => line.slice(indent.length));
    const nested = nestLino(lines.join('\n'), note).replace(/\n$/u, '');
    const indented = nested
      .split('\n')
      .map((line) => (line === '' ? '' : `${indent}${line}`))
      .join('\n');
    return `${indent}\`\`\`lino\n${indented}\n${indent}\`\`\``;
  });
}

function main(argv) {
  const check = argv.includes('--check');
  const files = argv.filter((arg) => arg !== '--check');
  let changed = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const note = (reason, group) =>
      console.error(
        `${file}: kept as written, ${reason}: ${group.split('\n')[0]}`
      );
    const nested = file.endsWith('.md')
      ? nestMarkdown(text, note)
      : nestLino(text, note);
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
