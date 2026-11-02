// Print ui-core parse() and the reference projection for a .lino file.
import { readFileSync } from 'node:fs';
import { parse, toTree } from '../../packages/ui-core/src/parse.js';
import {
  loadVocabulary,
  projectText,
} from '../../scripts/spec-reference-projection.mjs';

const text = readFileSync(process.argv[2], 'utf8');
const ours = JSON.stringify(toTree(parse(text)));
const ref = JSON.stringify(projectText(text, loadVocabulary()).tree);
console.log('ui-core  ', ours);
console.log('reference', ref);
console.log(ours === ref ? 'SAME' : 'DIFFERENT');
