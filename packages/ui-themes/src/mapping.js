import { parseNested } from '@link-foundation/ui-core';
const raw = (link) => (link.values.length ? link.values.map(raw) : link.id);
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
      typeof kind !== 'string' ||
      !['mapped', 'partial', 'unsupported'].includes(status) ||
      fields.some((field) => !Array.isArray(field)) ||
      fields.filter((field) => field[0] === 'kind').length !== 1 ||
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
      kind,
      status,
      props: fields
        .filter((f) => f[0] === 'prop')
        .map(([, name, value, target]) => ({ name, value, target })),
      note: fields.find((f) => f[0] === 'note')?.[1] ?? '',
    };
  });
}
const cell = (text) =>
  String(text)
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .replaceAll('*', '\\*');
/** Deterministic Markdown used by every design-system mapping. */
export function mappingMarkdown(rows) {
  return `${[
    '| Component | Kind | Props | Status | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${[row.component, row.kind, row.props.map((p) => `${p.name}=${p.value} → ${p.target.join(' ')}`).join('; '), row.status, row.note].map(cell).join(' | ')} |`
    ),
  ].join('\n')}\n`;
}
