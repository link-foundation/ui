// Shape of ui-core parse output for (t ...) message references.
import { parse, format } from '@link-foundation/ui-core';
const doc = parse(`(app: document (i18n required) (locale ru)
  (ok: button (label (t ok.label)))
  (greeting: text (t greeting (name 'Ada')))
  (plain: text 'Hello'))`);
console.log(JSON.stringify(doc, null, 1));
console.log(format(doc));
