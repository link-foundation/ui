// How ui-config resolves the root `locale` prop (absent, unknown sublink, set in user).
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
for (const src of [
  '(app: document (ok: button (label (t ok.label))))',
  '(app: document (locale zh) (ok: button))',
]) {
  const config = createConfig({ document: parse(src) });
  console.log('base', config.base, 'resolve', config.resolve('app', 'locale'));
  config.subscribe((events) => console.log('events', JSON.stringify(events)));
  config.set('user', 'app', 'locale', ['ru']);
  console.log('after set', config.resolve('app', 'locale'));
  config.clear('user');
  console.log('after clear', config.resolve('app', 'locale'));
}
