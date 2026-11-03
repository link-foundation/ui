#!/usr/bin/env node
/**
 * Reads the design guidelines digest data (`docs/guidelines/*.lino`) with the
 * official `links-notation` parser and renders the Markdown tables of
 * `component-catalogue.md` and `token-taxonomy.md` from it.
 *
 * Usage:
 *   node scripts/guidelines-tables.mjs          # rewrite the generated tables
 *   node scripts/guidelines-tables.mjs --check  # exit 1 when tables are stale
 *
 * The LiNo files are the source of truth; the tables sit between
 * `<!-- generated:NAME:start -->` and `<!-- generated:NAME:end -->` markers.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNested } from '../packages/ui-core/src/links.js';
import prettier from 'prettier';

export const guidelinesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'guidelines'
);

const NONE = '—';

/**
 * Parses a file of single-line records such as
 * `(button: component-entry (aria button) (owner '#34'))`.
 * @param {string} text LiNo source.
 * @returns {Array<{id: string, type: string, fields: Record<string, string[]>}>}
 */
export function parseRecords(text) {
  const links = parseNested(text);
  return links.map((link) => {
    const [head, ...rest] = link.values;
    /** @type {Record<string, string[]>} */
    const fields = {};
    for (const pair of rest) {
      const [key, ...values] = pair.values.map((value) => value.id);
      fields[key] = values;
    }
    return { id: link.id, type: head.id, fields };
  });
}

/**
 * @param {string} name LiNo file name inside docs/guidelines.
 * @returns {ReturnType<typeof parseRecords>}
 */
export function loadRecords(name) {
  return parseRecords(readFileSync(join(guidelinesDir, name), 'utf8'));
}

const escapeCell = (value) => value.replaceAll('|', '\\|');

/**
 * Renders one per-system cell: a link to the official page, `—` when the
 * system has no equivalent, and a "(verify)" mark when the name was not
 * confirmed on the official page.
 */
function systemCell(record, system) {
  const [name = NONE] = record.fields[system] ?? [];
  if (name === NONE) {
    return NONE;
  }
  const [url] = record.fields[`${system}-url`] ?? [];
  const verify = (record.fields.verify ?? []).includes(system)
    ? ' (verify)'
    : '';
  const text = escapeCell(name);
  return `${url ? `[${text}](${url})` : `\`${text}\``}${verify}`;
}

/**
 * @param {ReturnType<typeof parseRecords>} records Catalogue records.
 * @returns {string} Markdown table.
 */
export function renderCatalogueTable(records) {
  const header = [
    'Kind',
    'Open UI',
    'ARIA role / APG pattern',
    'Material 3',
    'Fluent 2',
    'Apple HIG',
    'MUI',
    'Keyboard (our summary)',
    'Owner',
  ];
  const rows = records
    .filter((record) => record.type === 'component-entry')
    .map((record) => {
      const aria = escapeCell(record.fields.aria[0]);
      const [apg] = record.fields.apg;
      const verifyApg = (record.fields.verify ?? []).includes('apg')
        ? ' (verify)'
        : '';
      return [
        `\`${record.id}\``,
        systemCell(record, 'open-ui'),
        apg === NONE ? aria : `[${aria}](${apg})${verifyApg}`,
        systemCell(record, 'material3'),
        systemCell(record, 'fluent'),
        systemCell(record, 'hig'),
        systemCell(record, 'mui'),
        escapeCell(record.fields.keyboard[0]),
        record.fields.owner[0],
      ];
    });
  return renderTable(header, rows);
}

/**
 * @param {ReturnType<typeof parseRecords>} records Taxonomy records.
 * @returns {string} Markdown table of system tokens.
 */
export function renderTokenTable(records) {
  const header = [
    'Ours',
    'Material 3',
    'Fluent 2',
    'Apple HIG concept',
    'DTCG `$type`',
  ];
  const code = (record, system) => {
    const [value] = record.fields[system];
    if (value === NONE) {
      return NONE;
    }
    const verify = (record.fields.verify ?? []).includes(system)
      ? ' (verify)'
      : '';
    const text = system === 'hig' ? escapeCell(value) : `\`${value}\``;
    return `${text}${verify}`;
  };
  const rows = records
    .filter((record) => record.type === 'token-entry')
    .map((record) => [
      `\`${record.id}\``,
      code(record, 'material3'),
      code(record, 'fluent'),
      code(record, 'hig'),
      `\`${record.fields['dtcg-type'][0]}\``,
    ]);
  return renderTable(header, rows);
}

function renderTable(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join(
    '\n'
  );
}

/**
 * Replaces the text between generated markers.
 * @param {string} markdown Document text.
 * @param {string} name Marker name.
 * @param {string} body New generated content.
 */
export function replaceGenerated(markdown, name, body) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const from = markdown.indexOf(start);
  const to = markdown.indexOf(end);
  if (from < 0 || to < from) {
    throw new Error(`Missing ${start} / ${end} markers`);
  }
  return `${markdown.slice(0, from + start.length)}\n\n${body}\n\n${markdown.slice(to)}`;
}

/**
 * Renders both documents and formats them with the repository Prettier
 * config, so the result is byte-comparable with the committed files.
 * @returns {Promise<Array<{file: string, expected: string, actual: string}>>}
 */
export function renderAll() {
  const targets = [
    [
      'component-catalogue.md',
      'catalogue',
      renderCatalogueTable(loadRecords('catalogue.lino')),
    ],
    [
      'token-taxonomy.md',
      'tokens',
      renderTokenTable(loadRecords('tokens-taxonomy.lino')),
    ],
  ];
  return Promise.all(
    targets.map(async ([file, name, table]) => {
      const path = join(guidelinesDir, file);
      // Normalise CRLF so Windows checkouts compare equal to LF output.
      const actual = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
      const options = (await prettier.resolveConfig(path)) ?? {};
      const expected = await prettier.format(
        replaceGenerated(actual, name, table),
        { ...options, filepath: path }
      );
      return { file, expected, actual };
    })
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = false;
  for (const { file, expected, actual } of await renderAll()) {
    if (expected === actual) {
      continue;
    }
    if (check) {
      console.error(`${file} is stale; run node scripts/guidelines-tables.mjs`);
      stale = true;
    } else {
      writeFileSync(join(guidelinesDir, file), expected);
      console.log(`updated ${file}`);
    }
  }
  process.exitCode = stale ? 1 : 0;
}
