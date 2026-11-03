/**
 * Reproduces the Windows CI failures of PR 108: a checkout with
 * core.autocrlf=true gives the roadmap sources and the protocol fixture CRLF.
 * Usage: node experiments/issue-101/crlf-checkout-probe.mjs
 */
import { readFileSync } from 'node:fs';
import { parseIssueFile } from '../issue-1/create-roadmap-issues.mjs';

const toCrlf = (text) => text.replaceAll('\n', '\r\n');
const issue = readFileSync(
  'docs/case-studies/issue-101/roadmap/issues/L01.md',
  'utf8'
);
for (const [name, text] of [
  ['LF', issue],
  ['CRLF', toCrlf(issue)],
]) {
  try {
    parseIssueFile(text, 'L01.md');
    console.log(`${name} issue file: parsed`);
  } catch (error) {
    console.log(`${name} issue file: ${error.message}`);
  }
}
const fixture = readFileSync(
  'packages/ui-links/tests/fixtures/links-operations.txt',
  'utf8'
);
for (const [name, text] of [
  ['LF', fixture],
  ['CRLF', toCrlf(fixture)],
]) {
  const lines = text.split('\n');
  const first = lines.find((line) => line !== '' && !line.startsWith('#'));
  console.log(
    `${name} fixture: first step line ${JSON.stringify(first)}, starts with "> ": ${first.startsWith('> ')}`
  );
}
