// Vocabulary property types, valueMatches and format of one element (#54).
import {
  defaultVocabulary,
  valueMatches,
  format,
  parse,
} from '@link-foundation/ui-core';
const v = defaultVocabulary();
console.log(
  v.kinds.get('button'),
  v.kinds.get('stack').properties.get('direction')
);
for (const [t, x] of [
  ['dimension', '16px'],
  ['dimension', '16'],
  ['dimension', 'abc'],
  ['color', '#fff'],
  ['color', 'red'],
  ['number', '2'],
  [['enum', 'a', 'b'], 'a'],
  ['dimension', ['token', 'space.medium']],
  ['url', 'x'],
  ['element-ref', 'ok'],
  ['duration', '150ms'],
]) {
  console.log(t, x, valueMatches(t, x));
}
const doc = parse(
  `(app: document (body: stack (gap (token space.medium)) (greeting: text 'Hello, links') (ok: button (label 'OK') (on press (navigate home)))))`
);
const ok = doc.byId.get('ok');
console.log(ok);
console.log(format({ roots: [ok], unknown: [] }));
console.log(format({ roots: [doc.byId.get('body')], unknown: [] }));
