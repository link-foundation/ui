import { formatLinks, parseNested } from '@link-foundation/ui-core';

const name = (record) => record.id ?? record.values[0]?.id;

/** Preserve the original option records other than the three solved fields. */
export function applyDoubletSolution(input, solution) {
  const { turns, linkGaps, frame, delta } = solution;
  const records = [];
  const linkFields = new Map();
  for (const record of parseNested(input)) {
    if (name(record) === 'link') {
      const [id, ...fields] = record.values.slice(record.id === null ? 1 : 0);
      linkFields.set(
        Number(id.id),
        fields.filter((field) => !['turns', 'gaps'].includes(name(field)))
      );
    } else if (name(record) !== 'frame') {
      records.push(record);
    }
  }
  if (frame) {
    records.push(['frame', ...frame.map(String)]);
  }
  for (let i = 0; i < delta.length; i++) {
    const fields = linkFields.get(i + 1) ?? [];
    if (turns[i]?.some(Boolean)) {
      fields.push(['turns', ...turns[i].map(String)]);
    }
    if (linkGaps[i]?.some((gap) => gap !== null)) {
      fields.push([
        'gaps',
        ...linkGaps[i].map((gap) => (gap === null ? '~' : String(gap))),
      ]);
    }
    if (fields.length) {
      records.push(['link', String(i + 1), ...fields]);
    }
  }
  return formatLinks(records);
}
