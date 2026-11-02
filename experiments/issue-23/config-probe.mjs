import { parse } from '@link-foundation/ui-core';
import { createConfig, writePatch } from '@link-foundation/ui-config';
const doc = parse(`(app: document
  (settings: panel (theme.mode dark)))`);
console.log(JSON.stringify(doc.diagnostics ?? doc).slice(0, 300));
const config = createConfig({ document: doc });
config.subscribe((events) => console.log('events', JSON.stringify(events)));
config.set('user', 'settings', 'liquid.blur', ['24']);
console.log(
  config.explain('settings', 'theme.mode'),
  config.resolve('settings', 'liquid.blur')
);
const text = writePatch({
  name: 'x',
  layer: 'user',
  base: 'app',
  ops: [
    { op: 'set', id: 'settings', name: 'accent', values: ['#ff0000'] },
    { op: 'unset', id: 'settings', name: 'liquid.blur' },
  ],
});
console.log(text);
console.log(config.importPatch(text, 'user'));
console.log(
  config.importPatch(
    writePatch({
      name: 'x',
      layer: 'user',
      base: 'app',
      ops: [{ op: 'unset', id: 'nope', name: 'a' }],
    }),
    'user'
  )
);
console.log(config.overrides('user'));
