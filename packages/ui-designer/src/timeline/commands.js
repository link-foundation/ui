/** Source-span edits, committed through the designer session as one transaction. */
import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import {
  indexSource,
  findElement,
  applyEdits,
} from '@link-foundation/ui-core/source';
import {
  readTimeline,
  moveKeyframe,
  insertKeyframe,
  deleteKeyframe,
  moveEvent,
} from './model.js';

const edit = (span, insert) => ({ start: span.start, end: span.end, insert });
const atom = (value) =>
  formatLinks([['value', value]])
    .trim()
    .slice(6);
const formatted = (values, span) => {
  const text = formatLinks([values]).trimEnd();
  if (!span.startsLine) {
    return formatLinks([values], { style: 'inline' }).trim();
  }
  return text.split('\n').join(`\n${span.indent}`);
};
function replaceOrdered(text, spans, values, order) {
  return applyEdits(
    text,
    spans.map((span, i) => edit(span, values[order[i]]))
  );
}
/** Returns text only; callers may compose multiple operations before committing. */
export function timelineEdit(text, change) {
  const { id, type } = change;
  const { node } = findElement(indexSource(text).root, id) ?? {};
  if (!node) {
    throw new RangeError(`Unknown timeline ${id}`);
  }
  const model = readTimeline(text);
  const animation = model.animations.find((a) => a.id === id);
  const recording = model.recordings.find((r) => r.id === id);
  const props = (name) => node.children.filter((p) => p.name === name);
  if (type === 'duration') {
    if (!Number.isFinite(change.ms) || change.ms <= 0) {
      throw new RangeError('Duration must be positive');
    }
    if (Array.isArray(animation.duration) && !change.replaceToken) {
      throw new Error('Replacing a duration token requires confirmation');
    }
    const span = props('duration')[0];
    return applyEdits(text, [
      edit(span, formatted(['duration', `${Math.round(change.ms)}ms`], span)),
    ]);
  }
  if (type.startsWith('key-')) {
    return editKey(text, change, animation, props);
  }
  return editEvent(text, change, recording, node, props);
}

function editKey(text, change, animation, props) {
  const { track: trackIndex = 0, index, type } = change;
  const track = animation.tracks[trackIndex];
  const span = props('track')[trackIndex];
  const keys = span.children.filter((c) => c.children[0]?.text === 'key');
  if (type === 'key-insert') {
    const next = insertKeyframe(track, change.offset, change.value);
    const key = next.keys.find((k) => !track.keys.includes(k));
    const before = keys.find((_, i) => track.keys[i].offset > key.offset);
    const reference = before ?? keys.at(-1);
    const raw = formatted(['key', String(key.offset), key.value], reference);
    const point = before ? before.start : reference.end;
    const insert = before
      ? `${raw}\n${reference.indent}`
      : `\n${reference.indent}${raw}`;
    return applyEdits(text, [{ start: point, end: point, insert }]);
  }
  if (type === 'key-delete') {
    deleteKeyframe(track, index);
    return applyEdits(text, [edit(keys[index], '')]);
  }
  if (type === 'key-value' || type === 'key-easing') {
    const key = keys[index];
    if (type === 'key-value') {
      return applyEdits(text, [edit(key.children[2], atom(change.value))]);
    }
    const easing = key.children[3];
    return applyEdits(text, [
      easing
        ? edit(easing, atom(change.value))
        : {
            start: key.children.at(-1).end,
            end: key.children.at(-1).end,
            insert: ` ${atom(change.value)}`,
          },
    ]);
  }
  const next = moveKeyframe(track, index, change.offset);
  const moved = Math.max(0, Math.min(1, change.offset));
  const times = track.keys.map((k, i) => (i === index ? moved : k.offset));
  const order = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const values = keys.map((k, i) =>
    i === index
      ? applyEdits(text.slice(k.start, k.end), [
          {
            start: k.children[1].start - k.start,
            end: k.children[1].end - k.start,
            insert: String(moved),
          },
        ])
      : text.slice(k.start, k.end)
  );
  if (next.keys.length !== keys.length) {
    throw new Error('Invalid track');
  }
  // A non-crossing move changes only the offset atom, preserving all other bytes.
  if (order.every((n, i) => n === i)) {
    return applyEdits(text, [edit(keys[index].children[1], String(moved))]);
  }
  return replaceOrdered(text, keys, values, order);
}

function editEvent(text, change, recording, node, props) {
  const { index, type } = change;
  const spans = props('event');
  if (type === 'event-delete') {
    return applyEdits(text, [edit(spans[index], '')]);
  }
  if (type === 'event-action') {
    const links = parseLinks(change.value);
    if (links.length !== 1 || !Array.isArray(links[0])) {
      throw new Error('Enter one LiNo action');
    }
    const span = spans[index].children[1];
    return applyEdits(text, [edit(span, formatted(links[0], span))]);
  }
  if (type === 'event-insert') {
    return insertEvent(text, change, recording, node, spans);
  }
  moveEvent(recording, index, change.ms);
  const times = recording.events.map((e, i) =>
    i === index ? Math.max(0, Math.round(change.ms)) : e.timeMs
  );
  const order = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  if (order.every((n, i) => n === i)) {
    return applyEdits(text, [
      edit(spans[index].children[0], `${times[index]}ms`),
    ]);
  }
  const values = spans.map((s, i) =>
    applyEdits(text.slice(s.start, s.end), [
      edit(
        {
          start: s.children[0].start - s.start,
          end: s.children[0].end - s.start,
        },
        `${times[i]}ms`
      ),
    ])
  );
  return replaceOrdered(text, spans, values, order);
}
function insertEvent(text, change, recording, node, spans) {
  if (!Number.isFinite(change.ms)) {
    throw new RangeError('Time must be finite');
  }
  const actions = parseLinks(change.value ?? "mark 'New event'");
  const action = actions[0];
  if (actions.length !== 1 || !Array.isArray(action)) {
    throw new Error('Enter one LiNo action');
  }
  // Keep inline events inside their containing link; nested events retain indentation.
  const before = spans.find((_, i) => recording.events[i].timeMs > change.ms);
  const reference = before ?? spans.at(-1);
  const shape = reference ?? {
    startsLine: node.form !== 'inline',
    indent: `${node.indent}  `,
  };
  const raw = formatted(
    ['event', `${Math.max(0, Math.round(change.ms))}ms`, action],
    shape
  );
  const separator = shape.startsLine ? `\n${shape.indent}` : ' ';
  const point =
    before?.start ??
    reference?.end ??
    (node.form === 'inline' ? node.end - 1 : node.end);
  return applyEdits(text, [
    {
      start: point,
      end: point,
      insert: before ? `${raw}${separator}` : `${separator}${raw}`,
    },
  ]);
}
export function runTimelineCommand(session, changes) {
  const text = (Array.isArray(changes) ? changes : [changes]).reduce(
    timelineEdit,
    session.getText()
  );
  const result = session.editSource(text);
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result;
}
