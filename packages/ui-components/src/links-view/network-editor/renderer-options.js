import { formatLinks } from '@link-foundation/ui-core';
import { normalize } from './options.js';
import { networkOptionSchema } from './schema.js';

function linkOverrides(options, index) {
  const values = [];
  const turns = options.turns[index];
  const gaps = options.linkGaps[index];
  const color = options.linkColors[index];
  if (turns) {
    values.push({ id: 'turns', values: turns.map(String) });
  }
  if (gaps) {
    values.push({
      id: 'gaps',
      values: gaps.map((value) => (value === null ? '~' : String(value))),
    });
  }
  if (color) {
    values.push({ id: 'color', values: [color] });
  }
  return values;
}

/** Translate the editor vocabulary into the built-in renderer's nested LiNo. */
export function rendererOptions(input, count) {
  const options = normalize(input),
    records = [],
    groups = new Map();
  for (const field of networkOptionSchema) {
    if (
      field.key === 'solve' ||
      field.key === 'quality' ||
      options[field.key] === field.default
    ) {
      continue;
    }
    const [group, key] = field.key.split('.');
    const entry = { id: key ?? group, values: [String(options[field.key])] };
    if (!key) {
      records.push(entry);
    } else {
      if (!groups.has(group)) {
        const node = { id: group, values: [] };
        groups.set(group, node);
        records.push(node);
      }
      groups.get(group).values.push(entry);
    }
  }
  const gaps = ['startGap', 'endGap', 'middleBefore', 'middleAfter'];
  // These editor keys are represented by the provider's single gaps vector.
  const filtered = records.filter((entry) => !gaps.includes(entry.id));
  if (gaps.some((key) => options[key] !== normalize({})[key])) {
    filtered.push({
      id: 'gaps',
      values: gaps.map((key) => String(options[key])),
    });
  }
  for (const key of ['frame', 'order']) {
    if (options[key] && (key !== 'order' || options.order.length === count)) {
      filtered.push({ id: key, values: options[key].map(String) });
    }
  }
  for (let i = 0; i < count; i++) {
    const values = linkOverrides(options, i);
    if (values.length) {
      filtered.push({ values: ['link', String(i + 1), ...values] });
    }
  }
  return formatLinks(filtered);
}
