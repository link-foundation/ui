#!/usr/bin/env node
/**
 * The ```lino blocks of the ui-components README read the same with their
 * own readers before and after the nested rewrite (#133): the link-view
 * model, the diagram model and the ui-core tree.
 *
 *   node experiments/issue-133/readme-blocks-readers.mjs <old.md> <new.md>
 */
import { readFileSync } from 'node:fs';
import { parse } from '../../packages/ui-core/src/index.js';
import { parseLinkView } from '../../packages/ui-components/src/links-view/model.js';
import { parseDiagram } from '../../packages/ui-components/src/diagrams/diagram-model.js';

const blocks = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/```lino\n([\s\S]*?)```/gu)].map(
    (m) => m[1]
  );
const [before, after] = process.argv.slice(2).map(blocks);
const readers = { parse, parseLinkView, parseDiagram };
const tree = (doc) =>
  JSON.stringify(doc, (k, v) =>
    k === 'span' || k === 'source' ? undefined : v
  );
before.forEach((old, i) => {
  for (const [name, read] of Object.entries(readers)) {
    let a, b;
    try {
      a = tree(read(old));
    } catch (e) {
      a = `throws ${e.message}`;
    }
    try {
      b = tree(read(after[i]));
    } catch (e) {
      b = `throws ${e.message}`;
    }
    console.log(`block ${i} ${name}: ${a === b ? 'same' : 'DIFFERENT'}`);
  }
});
