/* global URL */
import { parseNested } from '@link-foundation/ui-core';
/** Read package data in browsers and Node without a build. */
export async function readThemeFile(path) {
  const url = new URL(`../themes/${path}`, import.meta.url);
  if (url.protocol === 'file:') {
    return (await import('node:fs/promises')).readFile(url, 'utf8');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot load theme data: ${response.status} ${path}`);
  }
  return response.text();
}
const raw = (link) => (link.values.length ? link.values.map(raw) : link.id);

const fieldValue = (fields, name) =>
  fields.find((field) => field[0] === name)?.[1];

function validKind(kind, status, fields) {
  const count = fields.filter((field) => field[0] === 'kind').length;
  return typeof kind === 'string'
    ? count === 1
    : kind === null && status === 'none' && count === 0;
}

function validProps(props) {
  return props.every(
    ({ property, value, target }) =>
      typeof property === 'string' &&
      typeof value === 'string' &&
      Array.isArray(target) &&
      target.length >= 2 &&
      target.every((atom) => typeof atom === 'string')
  );
}

/** Read the shared #48 table format without interpreting source-language code. */
function parseMapping(text, extended = false) {
  const names = new Set();
  const fieldNames = ['kind', 'status', 'prop', ...(extended ? ['note'] : [])];
  const statuses = [
    'mapped',
    'partial',
    'none',
    ...(extended ? ['unsupported'] : []),
  ];
  return parseNested(text)
    .map(raw)
    .map((row) => {
      if (!Array.isArray(row)) {
        throw new TypeError('Invalid mapping row');
      }
      const [head, name, ...fields] = row;
      if (
        !fields.every(
          (field) =>
            Array.isArray(field) &&
            fieldNames.includes(field[0]) &&
            field.length === (field[0] === 'prop' ? 4 : 2)
        )
      ) {
        throw new TypeError('Invalid mapping field');
      }
      const kind = fieldValue(fields, 'kind') ?? null;
      const status = fieldValue(fields, 'status');
      const props = fields
        .filter((field) => field[0] === 'prop')
        .map(([, property, value, target]) => ({ property, value, target }));
      if (
        head !== 'map' ||
        typeof name !== 'string' ||
        !validKind(kind, status, fields) ||
        names.has(name) ||
        fields.filter((field) => field[0] === 'status').length !== 1 ||
        !validProps(props) ||
        !statuses.includes(status)
      ) {
        throw new TypeError('Invalid mapping row');
      }
      names.add(name);
      return {
        name,
        kind,
        status,
        props,
        ...(extended ? { note: fieldValue(fields, 'note') ?? '' } : {}),
      };
    });
}

/** Preserve the shared SwiftUI/MUI row API. */
export function readMapping(text) {
  return parseMapping(text);
}
/** Fluent mappings add explanatory notes and an unsupported status. */
export function loadMapping(text) {
  return parseMapping(text, true).map(
    ({ name, kind, status, props, note }) => ({
      component: name,
      kind,
      status,
      note,
      props: props.map(({ property, value, target }) => ({
        name: property,
        value,
        target,
      })),
    })
  );
}
const cell = (text) => String(text).replaceAll('*', '\\*');
/** Shared table writer; callers can retain their own columns and inline markup. */
export function mappingTable(headers, rows) {
  const row = (cells) =>
    `| ${cells.map((value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`;
  return `${[row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n')}\n`;
}
/** Deterministic Markdown used by design-system mappings. */
export function mappingMarkdown(rows) {
  return mappingTable(
    ['Component', 'Kind', 'Props', 'Status', 'Notes'],
    rows.map((row) =>
      [
        row.component,
        row.kind ?? '—',
        row.props
          .map((p) => `${p.name}=${p.value} → ${p.target.join(' ')}`)
          .join('; '),
        row.status,
        row.note,
      ].map((text) => cell(text))
    )
  );
}
