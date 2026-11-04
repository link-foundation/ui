// Bounded offline analysis of one preserved job log; no subprocesses/network.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const file = process.argv[2];
const bytes = readFileSync(file);
const lines = (file.endsWith('.gz') ? gunzipSync(bytes) : bytes)
  .toString()
  // gh logs may contain either ESC or its printable ^[ representation.
  // eslint-disable-next-line no-control-regex
  .replace(/(?:\x1b|\^\[)\[[\d;]*m/g, '')
  .split('\n');
const allRows = lines.map((text, index) => ({
  line: index + 1,
  time: text.match(/\d{4}-\d\d-\d\dT[\d:.]+Z/)?.[0],
  text,
}));
// Exclude the separate formatter probes after the suite (including failures).
const start = allRows.findIndex((row) =>
  /Running Deno test suite/.test(row.text)
);
const end = allRows.findIndex(
  (row, index) =>
    index >= start &&
    /Deno test suite (?:finished|did not finish)/.test(row.text)
);
const rows = allRows.slice(Math.max(0, start), end < 0 ? undefined : end + 1);
for (const [label, pattern] of [
  ['suite', /Running Deno test suite/],
  ['download', /Download https:\/\/registry/],
  ['initialize', /Initialize /],
  ['check', /Check (?:packages|tests)\//],
  ['test result', /\.\/.* => .*\.\.\. /],
  ['preflight result', /\.\/tests\/release-preflight.test.js =>/],
  ['end', /Deno test suite (?:finished|did not finish)/],
]) {
  const hits = rows.filter((row) => pattern.test(row.text));
  console.log(
    label,
    JSON.stringify({
      count: hits.length,
      first: hits[0] && { line: hits[0].line, time: hits[0].time },
      last: hits.at(-1) && { line: hits.at(-1).line, time: hits.at(-1).time },
    })
  );
}
const files = new Map();
for (const { text } of rows) {
  const match = text.match(/\.\/(.*?) => .*\.\.\. .*\(([\d.]+)(ms|s|µs)\)/);
  if (!match) {
    continue;
  }
  const [, name, duration, unit] = match;
  const seconds = Number(duration) * { s: 1, ms: 0.001, µs: 0.000001 }[unit];
  const previous = files.get(name) ?? { cases: 0, seconds: 0 };
  files.set(name, {
    cases: previous.cases + 1,
    seconds: previous.seconds + seconds,
  });
}
console.log(
  'Top files by summed reported case duration (rounded by Deno; files overlap):'
);
console.table(
  [...files]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 10)
    .map(([file, { cases, seconds }]) => ({
      file,
      cases,
      seconds: seconds.toFixed(3),
    }))
);
