/** Pure timeline projections and immutable editing operations. Values remain LiNo values. */
import { parse } from '@link-foundation/ui-core';

export const fieldsOf = (node) => [
  ...node.properties.map(({ name, values }) => [name, ...values]),
  ...node.unknown.filter(Array.isArray),
];
export function durationMs(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object') {
    return durationMs(
      value.path ? value.value : `${value.value}${value.unit ?? 'ms'}`
    );
  }
  if (typeof value !== 'string') {
    return 0;
  }
  return value.endsWith('ms')
    ? Number(value.slice(0, -2))
    : value.endsWith('s')
      ? Number(value.slice(0, -1)) * 1000
      : Number(value);
}
export function readTimeline(tree, resolveToken = () => undefined) {
  if (typeof tree === 'string') {
    tree = parse(tree);
  }
  if (tree.toDocument) {
    tree = tree.toDocument();
  }
  const animations = [],
    recordings = [];
  const visit = (node) => {
    const fields = fieldsOf(node);
    const field = (name) => fields.find((f) => f[0] === name)?.[1];
    if (node.kind === 'animation') {
      const duration = field('duration');
      const resolved = Array.isArray(duration)
        ? resolveToken(duration[1])
        : duration;
      animations.push({
        id: node.id,
        target: field('target'),
        durationMs: Number.isFinite(durationMs(resolved))
          ? Math.max(0, durationMs(resolved))
          : 0,
        duration,
        tracks: fields
          .filter((f) => f[0] === 'track')
          .map(([, property, ...keys]) => ({
            property,
            keys: keys
              .filter((k) => k[0] === 'key')
              .map(([, offset, value, easing]) => ({
                offset: Number(offset),
                value,
                ...(easing === undefined ? {} : { easing }),
              })),
          })),
      });
    }
    if (node.kind === 'recording') {
      recordings.push({
        id: node.id,
        events: fields
          .filter((f) => f[0] === 'event')
          .map(([, time, action]) => ({ timeMs: durationMs(time), action })),
      });
    }
    node.children.forEach(visit);
  };
  tree.roots.forEach(visit);
  return { animations, recordings };
}
const finite = (n) => {
  if (!Number.isFinite(n)) {
    throw new RangeError('Time must be finite');
  }
  return n;
};
function indexAt(items, index) {
  if (!Number.isInteger(index) || !items[index]) {
    throw new RangeError('Invalid timeline index');
  }
  return items[index];
}
function sortedKeys(track, keys) {
  keys.sort((a, b) => a.offset - b.offset);
  if (
    keys.some((key, i) => i && Math.abs(key.offset - keys[i - 1].offset) < 1e-9)
  ) {
    throw new RangeError('Duplicate keyframe offset');
  }
  return { ...track, keys };
}
export function moveKeyframe(track, index, offset) {
  indexAt(track.keys, index);
  offset = Math.max(0, Math.min(1, finite(offset)));
  return sortedKeys(
    track,
    track.keys.map((k, i) => (i === index ? { ...k, offset } : { ...k }))
  );
}
export function insertKeyframe(track, offset, value) {
  return sortedKeys(track, [
    ...track.keys,
    { offset: Math.max(0, Math.min(1, finite(offset))), value },
  ]);
}
export function deleteKeyframe(track, index) {
  indexAt(track.keys, index);
  if (track.keys.length <= 2) {
    throw new RangeError('At least two keys must remain');
  }
  return { ...track, keys: track.keys.filter((_, i) => i !== index) };
}
export function moveEvent(recording, index, timeMs) {
  indexAt(recording.events, index);
  timeMs = Math.max(0, Math.round(finite(timeMs)));
  return {
    ...recording,
    events: recording.events
      .map((e, i) => (i === index ? { ...e, timeMs } : { ...e }))
      .sort((a, b) => a.timeMs - b.timeMs),
  };
}
