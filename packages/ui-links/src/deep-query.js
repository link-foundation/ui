/** Hasura expressions shared by local minilinks and the GraphQL adapter. */
import { LinksError } from './links.js';

export const badDeepQuery = (message) => new LinksError('bad-request', message);
export const equalDeepValue = (a, b) => {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && equalDeepValue(a[k], b[k]))
  );
};

const comparisons = () => ({
  _eq: equalDeepValue,
  _neq: (a, b) => !equalDeepValue(a, b),
  _in: (a, b) => b.some((v) => equalDeepValue(a, v)),
  _nin: (a, b) => !b.some((v) => equalDeepValue(a, v)),
  _gt: (a, b) => a > b,
  _gte: (a, b) => a >= b,
  _lt: (a, b) => a < b,
  _lte: (a, b) => a <= b,
  _is_null: (a, b) => (a === null || a === undefined) === b,
  _contains: (a, b) =>
    a &&
    typeof a === 'object' &&
    Object.keys(b).every((k) => equalDeepValue(a[k], b[k])),
});

/** Hasura scalar shorthand is accepted in addition to comparison objects. */
export function compareDeepValue(value, expression) {
  if (expression === undefined) {
    throw badDeepQuery('A comparison cannot be undefined');
  }
  if (
    expression === null ||
    typeof expression !== 'object' ||
    Array.isArray(expression)
  ) {
    return equalDeepValue(value, expression);
  }
  return Object.entries(expression).every(([operator, expected]) => {
    const compare = comparisons()[operator];
    if (!compare) {
      throw badDeepQuery(`Unsupported comparison ${operator}`);
    }
    if (operator !== '_is_null' && (value === null || value === undefined)) {
      return false;
    }
    return compare(value, expected);
  });
}

export const deepRelations = () => ({
  from: 'from_id',
  to: 'to_id',
  type: 'type_id',
  in: 'to_id',
  out: 'from_id',
  typed: 'type_id',
});

/** Resolve virtual ids and Deep package paths without changing the caller. */
export function resolveDeepQuery(input, ml) {
  if (typeof input === 'number') {
    return ml.virtual[input] ?? input;
  }
  if (!input || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((value) => resolveDeepQuery(value, ml));
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (['id', 'type_id', 'from_id', 'to_id', 'link_id'].includes(key)) {
        if (value && typeof value === 'object') {
          if (value._id) {
            return [
              key,
              {
                _eq:
                  ml.id(
                    ...value._id.filter((part) => typeof part !== 'boolean'),
                    true
                  ) ?? 0,
              },
            ];
          }
          const resolve = (id) => ml.virtual[id] ?? id;
          return [
            key,
            Object.fromEntries(
              Object.entries(value).map(([operator, expected]) => [
                operator,
                operator === '_is_null'
                  ? expected
                  : Array.isArray(expected)
                    ? expected.map(resolve)
                    : resolve(expected),
              ])
            ),
          ];
        }
        return [key, ml.virtual[value] ?? value];
      }
      return [
        key,
        key.startsWith('_') ||
        key === 'where' ||
        Object.hasOwn(deepRelations(), key)
          ? resolveDeepQuery(value, ml)
          : value,
      ];
    })
  );
}

function matchesDeepField(row, field, expression) {
  if (expression === undefined) {
    throw badDeepQuery(`${field} === undefined`);
  }
  if (Object.hasOwn(deepRelations(), field)) {
    const relation = row[field];
    const related = Array.isArray(relation) ? relation : [relation];
    return related.some((link) => link && matchesDeepWhere(link, expression));
  }
  if (
    ['string', 'number', 'object'].includes(field) ||
    (field === 'value' &&
      row.value &&
      typeof row.value === 'object' &&
      Object.hasOwn(row.value, 'value'))
  ) {
    return (
      row[field] !== null &&
      row[field] !== undefined &&
      matchesDeepWhere(row[field], expression)
    );
  }
  if (!Object.hasOwn(row, field)) {
    throw badDeepQuery(`Unsupported field ${field}`);
  }
  return compareDeepValue(row[field], expression);
}

/** Existential relation filters, with AND between the fields of an object. */
export function matchesDeepWhere(row, where = {}) {
  if (typeof where === 'number' || typeof where === 'string') {
    return row.id === where;
  }
  if (!where || Array.isArray(where)) {
    throw badDeepQuery('where must be an object or an id');
  }
  return Object.entries(where).every(([field, expression]) => {
    if (field === '_and') {
      return expression.every((part) => matchesDeepWhere(row, part));
    }
    if (field === '_or') {
      return expression.some((part) => matchesDeepWhere(row, part));
    }
    if (field === '_not') {
      return !matchesDeepWhere(row, expression);
    }
    return matchesDeepField(row, field, expression);
  });
}

/** Query-level controls may be supplied alongside where, as in DeepClient. */
export function deepQuery(input = {}, options = {}) {
  if (typeof input !== 'object' || input === null) {
    return { where: { id: { _eq: input } }, ...options };
  }
  const {
    limit,
    offset,
    order_by,
    distinct_on,
    return: returning,
    where,
    ...fields
  } = input;
  return {
    where: where ?? fields,
    limit,
    offset,
    order_by,
    distinct_on,
    return: returning,
    ...options,
  };
}

export function queryDeepRows(rows, input, options) {
  const q = deepQuery(input, options);
  deepWhere(q.where); // Validate even when there are no candidate rows.
  let result = rows.filter((row) => matchesDeepWhere(row, q.where));
  const ordering = [q.order_by ?? {}].flat();
  result.sort((a, b) => {
    for (const order of ordering) {
      for (const [key, direction] of Object.entries(order)) {
        const sign = direction.startsWith('desc') ? -1 : 1;
        if (a[key] !== b[key]) {
          return (a[key] < b[key] ? -1 : 1) * sign;
        }
      }
    }
    return 0;
  });
  if (q.distinct_on) {
    const seen = new Set();
    result = result.filter((row) => {
      const key = JSON.stringify(
        [q.distinct_on].flat().map((field) => row[field])
      );
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  const offset = q.offset ?? 0;
  return result.slice(
    offset,
    q.limit === undefined ? undefined : offset + q.limit
  );
}

function validateComparison(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [operator, expected] of Object.entries(value)) {
      if (!Object.hasOwn(comparisons(), operator) || expected === undefined) {
        throw badDeepQuery(`Unsupported comparison ${operator}`);
      }
      if (['_in', '_nin'].includes(operator) && !Array.isArray(expected)) {
        throw badDeepQuery(`${operator} must be an array`);
      }
      if (operator === '_is_null' && typeof expected !== 'boolean') {
        throw badDeepQuery('_is_null must be boolean');
      }
    }
  }
}

/** Normalize scalar shorthand before passing it to Hasura's bool_exp input. */
export function deepWhere(where) {
  if (typeof where !== 'object' || where === null) {
    return { id: { _eq: where } };
  }
  return Object.fromEntries(
    Object.entries(where).map(([key, value]) => {
      if (value === undefined) {
        throw badDeepQuery(`${key} === undefined`);
      }
      if (key === '_and' || key === '_or') {
        if (!Array.isArray(value)) {
          throw badDeepQuery(`${key} must be an array`);
        }
        return [key, value.map(deepWhere)];
      }
      if (
        key === '_not' ||
        Object.hasOwn(deepRelations(), key) ||
        ['string', 'number', 'object'].includes(key)
      ) {
        return [key, deepWhere(value)];
      }
      validateComparison(value);
      return [
        key,
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? value
          : { _eq: value },
      ];
    })
  );
}
