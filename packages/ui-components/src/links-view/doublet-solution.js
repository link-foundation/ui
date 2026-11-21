import { formatLinks, parseNested } from '@link-foundation/ui-core';

/** Preserve the original option records other than the three solved fields. */
export function applyDoubletSolution(input, solution) {
  const { turns, linkGaps, frame } = solution;
  const records = parseNested(input).filter(
    (record) => !['frame', 'link'].includes(record.id ?? record.values[0]?.id)
  );
  if (frame) {
    records.push(['frame', ...frame.map(String)]);
  }
  for (let i = 0; i < Math.max(turns.length, linkGaps.length); i++) {
    const fields = [];
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
