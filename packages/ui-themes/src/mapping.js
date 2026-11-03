import { parseNested } from '@link-foundation/ui-core';

const raw = (link) => (link.values.length ? link.values.map(raw) : link.id);

function validKind(kind, status, fields) {
  const count = fields.filter((field) => field[0] === 'kind').length;
  return typeof kind === 'string'
    ? count === 1
    : kind === null && status === 'none' && count === 0;
}

/** Read the shared #48 table format without interpreting source-language code. */
export function readMapping(text) {
  const names = new Set();
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
            ['kind', 'status', 'prop'].includes(field[0]) &&
            field.length === (field[0] === 'prop' ? 4 : 2)
        )
      ) {
        throw new TypeError('Invalid mapping field');
      }
      const kind = fields.find((field) => field[0] === 'kind')?.[1] ?? null;
      const status = fields.find((field) => field[0] === 'status')?.[1];
      const props = fields
        .filter((field) => field[0] === 'prop')
        .map(([, property, value, target]) => ({ property, value, target }));
      if (
        head !== 'map' ||
        typeof name !== 'string' ||
        !validKind(kind, status, fields) ||
        names.has(name) ||
        fields.filter((field) => field[0] === 'status').length !== 1 ||
        !props.every(
          ({ property, value, target }) =>
            typeof property === 'string' &&
            typeof value === 'string' &&
            Array.isArray(target) &&
            target.length >= 2 &&
            target.every((atom) => typeof atom === 'string')
        ) ||
        !['mapped', 'partial', 'none'].includes(status)
      ) {
        throw new TypeError('Invalid mapping row');
      }
      names.add(name);
      return { name, kind, status, props };
    });
}
