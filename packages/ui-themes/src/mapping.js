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
function hasKind(fields, kind, status) {
  return (
    (typeof kind === 'string' || status === 'none') &&
    fields.filter((field) => field[0] === 'kind').length ===
      (status === 'none' ? 0 : 1)
  );
}
/** Shared LiNo migration rows. Unknown statuses or malformed rows fail closed. */
export function loadMapping(text) {
  const seen = new Set();
  return parseNested(text).map((link) => {
    const [head, component, ...fields] = raw(link);
    const kind = fields.find((f) => f[0] === 'kind')?.[1];
    const status = fields.find((f) => f[0] === 'status')?.[1];
    if (
      head !== 'map' ||
      typeof component !== 'string' ||
      seen.has(component) ||
      !hasKind(fields, kind, status) ||
      !['mapped', 'partial', 'unsupported', 'none'].includes(status) ||
      fields.some((field) => !Array.isArray(field)) ||
      fields.filter((field) => field[0] === 'status').length !== 1 ||
      fields.some(
        (field) =>
          field[0] === 'prop' &&
          (field.length !== 4 ||
            typeof field[1] !== 'string' ||
            typeof field[2] !== 'string' ||
            !Array.isArray(field[3]) ||
            field[3].some((v) => typeof v !== 'string'))
      )
    ) {
      throw new TypeError('Invalid mapping row');
    }
    seen.add(component);
    return {
      component,
      kind: kind ?? null,
      status,
      props: fields
        .filter((f) => f[0] === 'prop')
        .map(([, name, value, target]) => ({ name, value, target })),
      note: fields.find((f) => f[0] === 'note')?.[1] ?? '',
    };
  });
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
