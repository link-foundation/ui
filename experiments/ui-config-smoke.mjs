import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import {
  createConfig,
  describeChanges,
  readPatch,
} from '@link-foundation/ui-config';
import { readFileSync } from 'node:fs';
const S = 'docs/case-studies/issue-1/samples/';
const doc = parse(
  readFileSync(`${S}document.lino`, 'utf8') +
    readFileSync(`${S}tokens.lino`, 'utf8')
);
const config = createConfig({ document: doc });
config.set('user', 'greeting', 'text', ['Hello, agents']);
config.set('user', 'material3', 'token', ['#00639B'], 'color.primary');
console.log(config.exportPatch());
console.log(readFileSync(`${S}overrides.lino`, 'utf8'));
console.log(describeChanges(config));
console.log(
  config.resolve('material3', 'token', 'color.on-primary'),
  config.explain('greeting', 'text')
);
const store = createStore({ document: doc });
store.subscribe((ev, e) =>
  console.log(
    'tx',
    e.origin,
    ev.map((x) => `${x.type} ${x.id}`)
  )
);
config.bindStore(store);
console.log(store.get('greeting'), store.get('material3').properties);
config.unset('user', 'greeting', 'text');
console.log(store.toLino());
console.log(readPatch('(x: overrides (layer user) (set nope a b) (bogus 1))'));
