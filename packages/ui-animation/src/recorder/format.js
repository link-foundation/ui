/** Recording links, read by the official parser through ui-core. */
import { formatLinks, parseLinks } from '@link-foundation/ui-core';

export const EVENT_KINDS = [
  'set',
  'insert',
  'remove',
  'move',
  'input',
  'play',
  'cancel',
  'mark',
];
const HEADERS = [
  'started',
  'seed',
  'viewport',
  'document',
  'snapshot',
  'redacted',
  'truncated',
];
function headerValue(name, args) {
  if (name === 'snapshot') {
    return formatLinks(args);
  }
  if (name === 'viewport') {
    const size = args.map(Number);
    if (
      size.length !== 2 ||
      size.some((n) => !Number.isSafeInteger(n) || n < 0)
    ) {
      throw new TypeError('Invalid viewport');
    }
    return size;
  }
  if (args.length !== 1 || typeof args[0] !== 'string') {
    throw new TypeError(`Invalid ${name}`);
  }
  if (name === 'seed') {
    const seed = Number(args[0]);
    if (!Number.isSafeInteger(seed)) {
      throw new TypeError('Invalid seed');
    }
    return seed;
  }
  if (['redacted', 'truncated'].includes(name)) {
    if (!['true', 'false'].includes(args[0])) {
      throw new TypeError(`Invalid ${name}`);
    }
    return args[0] === 'true';
  }
  return args[0];
}
function decodeEvent(args, previous) {
  const [stamp, payload] = args;
  const time =
    typeof stamp === 'string' && stamp.endsWith('ms')
      ? Number(stamp.slice(0, -2))
      : NaN;
  if (
    args.length !== 2 ||
    !Number.isSafeInteger(time) ||
    time < previous ||
    !Array.isArray(payload) ||
    !EVENT_KINDS.includes(payload[0])
  ) {
    throw new TypeError('Invalid event or non-monotonic timestamp');
  }
  return { time, kind: payload[0], args: payload.slice(1) };
}
export function parseRecording(text) {
  const roots = parseLinks(text);
  const root = roots.find(
    (link) => (link?.values ?? link)?.[0] === 'recording'
  );
  const values = root?.values ?? root;
  if (!values) {
    throw new TypeError('Expected a recording link');
  }
  const recording = { id: root.id ?? 'recording-1', events: [], headers: [] };
  let previous = 0;
  for (const field of values.slice(1)) {
    if (!Array.isArray(field)) {
      throw new TypeError('Expected a recording field');
    }
    const [name, ...args] = field;
    if (name !== 'event') {
      if (!HEADERS.includes(name) || recording.headers.includes(name)) {
        throw new TypeError(`Unknown or duplicate header ${name}`);
      }
      recording.headers.push(name);
      recording[name] = headerValue(name, args);
    } else {
      const event = decodeEvent(args, previous);
      previous = event.time;
      recording.events.push(event);
    }
  }
  return recording;
}
export function serializeRecording(recording) {
  const headers =
    recording.headers ?? HEADERS.filter((key) => recording[key] !== undefined);
  const fields = headers.map((key) => [
    key,
    ...(key === 'snapshot'
      ? parseLinks(recording[key])
      : key === 'viewport'
        ? recording[key].map(String)
        : [String(recording[key])]),
  ]);
  let previous = 0;
  for (const event of recording.events) {
    const raw = [`${event.time}ms`, [event.kind, ...event.args]];
    decodeEvent(raw, previous);
    previous = event.time;
    fields.push(['event', ...raw]);
  }
  return formatLinks([
    { id: recording.id ?? 'recording-1', values: ['recording', ...fields] },
  ]);
}
export const asRecording = (source) =>
  typeof source === 'string' ? parseRecording(source) : source;
