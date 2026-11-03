// Usage of @link-foundation/ui-components icons outside a browser: resolve
// own icons, switch to Lucide through its adapter (an optional peer
// dependency), and list the licence records of what is shown.
// Run: node examples/ui-components-icons.mjs
import {
  iconRecords,
  iconToSvg,
  registerIconSet,
  resolveIcon,
} from '@link-foundation/ui-components';
import { createLucideSource } from '@link-foundation/ui-components/icons/adapters/lucide';

// The own set (CC0-1.0) is always there.
const close = await resolveIcon('close');
console.log(close.set, close.record.license, iconToSvg(close));

// Lucide replaces the shapes. Each icon carries its ISC record.
const unregister = registerIconSet('lucide', createLucideSource());
const check = await resolveIcon({ set: 'lucide', name: 'check' });
console.log(check.set, check.record.license, check.record.copyright);

// A name that Lucide lacks falls back to the own set, then to a placeholder.
console.log((await resolveIcon('lucide:no-such-icon')).placeholder); // true

// Everything an app must credit for the Lucide set.
const licences = new Set(iconRecords(['lucide']).map((r) => r.license));
console.log([...licences]); // [ 'ISC AND MIT', 'ISC' ]
unregister();
