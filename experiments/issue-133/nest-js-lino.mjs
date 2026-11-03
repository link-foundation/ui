#!/usr/bin/env node
/**
 * Rewrite the Links Notation template literals of JavaScript sources in the
 * nested form (#133): `export const NAME = \`...\`;` constants whose text is
 * LiNo (a vocabulary, a token theme). The text is converted by `nestLino`
 * of scripts/lino-nest.mjs (read by `links-notation`, written by ui-core
 * `formatLinks`); a literal with `${`, a backslash or a backquote is skipped.
 *
 *   node experiments/issue-133/nest-js-lino.mjs NAME file.js...
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { nestLino } from '../../scripts/lino-nest.mjs';

const [name, ...files] = process.argv.slice(2);
const literal = new RegExp(
  `(?<head>export const ${name} = \`)(?<body>[^\`]*)(?<tail>\`;)`,
  'u'
);
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const match = literal.exec(text);
  if (match === null || /\$\{|\\/u.test(match.groups.body)) {
    console.error(`${file}: no plain ${name} literal`);
    continue;
  }
  const { head, body, tail } = match.groups;
  const nested = nestLino(body, (reason, group) =>
    console.error(`${file}: kept, ${reason}: ${group.split('\n')[0]}`)
  );
  const end = body.endsWith('\n') ? nested : nested.replace(/\n$/u, '');
  writeFileSync(
    file,
    text.replace(literal, () => head + end + tail)
  );
  console.log(`${file}: ${name} ${nested === body ? 'unchanged' : 'nested'}`);
}
