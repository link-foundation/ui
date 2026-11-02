// Probe: what checkHardcodedText sees in nested elements and broken input.
import { parse, defaultVocabulary } from '@link-foundation/ui-core';
import { checkHardcodedText } from '@link-foundation/ui-i18n';
console.log(
  Object.keys(defaultVocabulary().kinds ?? defaultVocabulary()).join(' ')
);
const t =
  "(app: document (i18n required) (form: container (name: input (placeholder 'Your name') (title '42')) (s: button (label '✓'))))";
const d = parse(t);
console.log(
  JSON.stringify(d.diagnostics),
  JSON.stringify(d.roots[0].children[0], null, 0).slice(0, 600)
);
console.log(
  checkHardcodedText(
    "(app: document (i18n required) (ok: button (label 'OK') (title 'Tip')))",
    { textProps: ['title'] }
  )
);
const b = parse('(app: document (i18n required) (ok: button (label)');
console.log(b.roots.length, JSON.stringify(b.diagnostics));
