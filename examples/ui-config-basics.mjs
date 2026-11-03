// Usage of @link-foundation/ui-config: resolve a property through the
// configuration layers, see which layer won, override it as the user, export
// the overrides as a LiNo patch for an agent, describe the changes, keep the
// user layer in storage and apply the configuration to a ui-store store.
// Run: node examples/ui-config-basics.mjs
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import {
  createConfig,
  describeChanges,
  persistUserLayer,
} from '@link-foundation/ui-config';

const document = parse(`app: document
  greeting: text 'Hello, links'
  material3: theme
    token color.primary '#6750A4'`);
const config = createConfig({ document });

config.set('user', 'greeting', 'text', ['Hello, agents']);
config.set('user', 'material3', 'token', ['#00639B'], 'color.primary');

console.log(config.resolve('greeting', 'text'));
// { layer: 'user', value: ['Hello, agents'] }
console.log(config.explain('greeting', 'text'));
// [{ layer: 'site', value: ['Hello, links'] }, { layer: 'user', value: ['Hello, agents'] }]

console.log(config.exportPatch());
// (user-overrides: overrides
//   (layer user)
//   (base app)
//   (set greeting text 'Hello, agents')
//   (set material3 token color.primary '#00639B'))

console.log(describeChanges(config));

// An in-memory stand-in for localStorage.
const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};
persistUserLayer(config, storage);
config.set('user', 'greeting', 'text', ['Hello, people']);
console.log(data.get('link-ui.config.user.v1'));

const reloaded = createConfig({ document });
persistUserLayer(reloaded, storage);
console.log(reloaded.resolve('greeting', 'text'));
// { layer: 'user', value: ['Hello, people'] }

const store = createStore({ document });
reloaded.bindStore(store);
reloaded.set('session', 'greeting', 'text', ['Hi']);
console.log(store.toLino({ style: 'inline' }));
console.log(store.log().map((entry) => `${entry.tx} ${entry.origin}`));
// ['1 config', '2 config']
