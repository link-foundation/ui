// Print the parsed tree of a small LiNo text with the interop vocabulary.
import { parse, format } from '@link-foundation/ui-core';
import { interopVocabulary } from '../../packages/ui-convert/src/interop/vocabulary.js';
const text = process.argv[2];
const doc = parse(text, { vocabulary: interopVocabulary() });
console.log(JSON.stringify(doc.roots, null, 1));
console.log(doc.diagnostics);
console.log(format(doc, { style: 'multiline' }));
