// Run insert/remove/move/rename on the three form fixtures and print the results.
import { readFileSync } from 'node:fs';
import { stripComments } from 'links-notation';
import * as S from '../packages/ui-core/src/source.js';

const dir = 'packages/ui-core/tests/fixtures/source/';
const comments = (text) => {
  const stripped = stripComments(text);
  const found = [];
  let run = '';
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text[i] !== stripped[i]) {
      run += text[i];
    } else if (run) {
      found.push(run.trim());
      run = '';
    }
  }
  return found;
};
const forms = {
  'form.one-line': '(note: text Note)',
  'form.multiline': '(note: text Note)',
  'form.indented': 'note: text Note',
};
for (const [name, child] of Object.entries(forms)) {
  const text = readFileSync(`${dir}${name}.lino`, 'utf8');
  console.log(`===== ${name}`, comments(text));
  const runs = {
    insert: S.insertChild(text, 'body', 1, child),
    remove: S.removeNode(text, 'greeting'),
    move: S.moveNode(text, 'greeting', 'body', 2),
    moveOut: S.moveNode(text, 'ok', 'app', 0),
    rename: S.renameId(text, 'ok', 'confirm'),
  };
  for (const [op, r] of Object.entries(runs)) {
    console.log(`--- ${op} ok=${r.ok} ${r.error ?? ''}`);
    if (r.ok) {
      console.log(r.text);
      console.log(comments(r.text));
    }
  }
}
