/* global URL */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { format } from 'prettier';
import { getSwiftuiMapping } from '../src/index.js';

/** The mapping is generated; the surrounding HIG guide remains hand-written. */
export async function swiftuiTable() {
  const rows = await getSwiftuiMapping();
  return [
    '| SwiftUI view | UI kind | Status | Modifiers |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      ({ name, kind, status, props }) =>
        `| ${name} | ${kind} | ${status} | ${props.map(({ property, value, target }) => `${property} ${value} → ${target.join(' ')}`).join('; ')} |`
    ),
  ].join('\n');
}
export async function generatedHigDoc() {
  const url = new URL('../../../docs/themes/hig.md', import.meta.url);
  const text = await readFile(url, 'utf8');
  const start = '<!-- generated:swiftui:start -->';
  const end = '<!-- generated:swiftui:end -->';
  return format(
    `${text.slice(
      0,
      text.indexOf(start) + start.length
    )}\n\n${await swiftuiTable()}\n\n${text.slice(text.indexOf(end))}`,
    { parser: 'markdown' }
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(
    new URL('../../../docs/themes/hig.md', import.meta.url),
    await generatedHigDoc()
  );
}
