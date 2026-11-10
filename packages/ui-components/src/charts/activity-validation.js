/** Validate the field roles needed by the activity layouts before drawing. */
import { fail } from './errors.js';

export function validateActivity(spec, node, path) {
  const { mark, encoding, data } = spec;
  const expected = {
    calendar: { x: 'temporal', y: 'quantitative' },
    range: { x: 'temporal', x2: 'temporal' },
    composition: { theta: 'quantitative' },
  }[mark.type];
  for (const [channel, type] of Object.entries(expected ?? {})) {
    if (encoding[channel].type !== type) {
      fail(
        'invalid-value',
        `${mark.type} requires ${type} ${channel}`,
        node,
        path
      );
    }
  }
  if (mark.type === 'range') {
    for (const row of data.values) {
      const end = row[encoding.x2.field];
      const endTime = !end || end === 'ongoing' ? spec.ongoingEnd : end;
      if (endTime && Date.parse(endTime) < Date.parse(row[encoding.x.field])) {
        fail('invalid-value', 'range end must not precede start', node, path);
      }
    }
  }
  return spec;
}
