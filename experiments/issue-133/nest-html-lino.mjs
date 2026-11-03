#!/usr/bin/env node
/**
 * Rewrite the `<script type="text/lino">` and `<ui-diagram>` blocks of HTML pages in the
 * nested form with scripts/lino-nest.mjs (#133), keeping each block's
 * indentation.
 *
 *   node experiments/issue-133/nest-html-lino.mjs <page.html>...
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { nestLino } from '../../scripts/lino-nest.mjs';

const BLOCK =
  /(?<open><(?<tag>script(?= type="text\/lino")|ui-diagram)\b[^>]*>\n)(?<body>[\s\S]*?)(?<close>\n[ \t]*<\/\k<tag>>)/gu;

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, 'utf8');
  const out = text.replace(BLOCK, (block, open, tag, body, close) => {
    const lines = body.split('\n');
    const indent = Math.min(
      ...lines
        .filter((l) => l.trim())
        .map((l) => l.length - l.trimStart().length)
    );
    const pad = ' '.repeat(indent);
    const nested = nestLino(
      lines.map((l) => l.slice(indent)).join('\n'),
      (reason, group) =>
        console.error(`${file}: ${reason}: ${group.split('\n')[0]}`)
    ).replace(/\n$/u, '');
    return `${open}${nested
      .split('\n')
      .map((l) => (l ? pad + l : l))
      .join('\n')}${close}`;
  });
  if (out !== text) {
    writeFileSync(file, out);
    console.log(`${file} rewritten`);
  }
}
