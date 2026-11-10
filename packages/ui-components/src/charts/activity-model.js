/** Optional activity-chart vocabulary shared by the LiNo reader and writer. */
import { fail } from './errors.js';
import { prop } from './lino.js';
import {
  numberList,
  optionalNumber,
  optionalText,
  properties,
} from './read.js';

export const ACTIVITY_PROPERTIES = [
  'corner-radius',
  'labels',
  'emphasis',
  'top-n',
  'week-start',
  'thresholds',
  'ongoing-end',
  'tooltip',
];
const NAMES = {
  'corner-radius': 'cornerRadius',
  'top-n': 'topN',
  'week-start': 'weekStart',
  'ongoing-end': 'ongoingEnd',
};

export function readActivity(props) {
  const result = {};
  for (const name of ACTIVITY_PROPERTIES) {
    const entry = props.get(name)?.[0];
    if (!entry) {
      continue;
    }
    let value;
    if (name === 'thresholds') {
      value = numberList(entry, name);
      if (
        value.length !== 4 ||
        value.some((v, i) => i > 0 && v <= value[i - 1])
      ) {
        fail(
          'invalid-value',
          'thresholds must be four increasing numbers',
          entry.node,
          entry.path
        );
      }
    } else if (name === 'tooltip') {
      const fields = properties(entry.node, entry.path, 1, ['layer']);
      value = { layer: optionalText(fields, 'layer') ?? 'top' };
      if (!['top', 'inline'].includes(value.layer)) {
        fail(
          'invalid-value',
          'tooltip layer must be top or inline',
          entry.node,
          entry.path
        );
      }
    } else {
      value = scalarActivity(props, name, entry);
    }
    result[NAMES[name] ?? name] = value;
  }
  return result;
}

export function activityNodes(spec) {
  return ACTIVITY_PROPERTIES.flatMap((name) => {
    const value = spec[NAMES[name] ?? name];
    if (value === undefined || value === null) {
      return [];
    }
    if (name === 'tooltip') {
      return [prop(name, prop('layer', value.layer ?? 'top'))];
    }
    return [
      prop(name, ...(Array.isArray(value) ? value : [value]).map(String)),
    ];
  });
}

export function readScale(entry) {
  const fields = properties(entry.node, entry.path, 1, ['type', 'base']);
  const type = optionalText(fields, 'type');
  const base = optionalNumber(fields, 'base', 10);
  if (type !== 'log' || base <= 1) {
    fail(
      'invalid-value',
      'scale requires type log and base > 1',
      entry.node,
      entry.path
    );
  }
  return { type, base };
}

function scalarActivity(props, name, entry) {
  let value;
  if (['corner-radius', 'top-n', 'week-start'].includes(name)) {
    value = optionalNumber(props, name);
    if (
      value < 0 ||
      (name !== 'corner-radius' && !Number.isInteger(value)) ||
      (name === 'top-n' && value < 1) ||
      (name === 'week-start' && value > 6)
    ) {
      fail('invalid-value', `invalid ${name}`, entry.node, entry.path);
    }
  } else {
    value = optionalText(props, name);
    if (name === 'labels' && !['peaks', 'last'].includes(value)) {
      fail(
        'invalid-value',
        'labels must be peaks or last',
        entry.node,
        entry.path
      );
    }
    if (name === 'ongoing-end' && !Number.isFinite(Date.parse(value))) {
      fail(
        'invalid-value',
        'ongoing-end must be a date',
        entry.node,
        entry.path
      );
    }
  }
  return value;
}
