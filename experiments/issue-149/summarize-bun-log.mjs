// Attribute Bun's reported test durations to files without running the suite.
// Usage: node experiments/issue-149/summarize-bun-log.mjs <job.log[.gz]>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const file = process.argv[2];
if (!file) {
  throw new Error('Expected a downloaded Bun job log (.log or .log.gz)');
}
const bytes = readFileSync(file);
const log = (file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
const totals = new Map();
const operations = [];
let current;
for (const [index, line] of log.split('\n').entries()) {
  const group = line.match(/##\[group\]((?:tests|packages)[\\/].*\.test\.js):/);
  if (group) {
    current = group[1].replaceAll('\\', '/');
  }
  const duration = line.match(/\[([\d.]+)ms\]/);
  if (current && duration) {
    const ms = Number(duration[1]);
    totals.set(current, (totals.get(current) ?? 0) + ms);
    operations.push({ ms, line: index + 1, test: line.split('Z ').at(-1) });
  }
}
console.log(
  'File totals (sum of reported test durations, not wrapper wall time):'
);
for (const [name, ms] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`${(ms / 1000).toFixed(3)}s\t${name}`);
}
console.log(
  'Ten slowest operations (line numbers in the decompressed job log):'
);
for (const { line, test } of operations
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 10)) {
  console.log(`${line}: ${test}`);
}
