import layout from '../inspector.lino?raw';
import { mountForeignDevMode } from './entry.js';
// Serialize repeated toolbar clicks while the inspector is opening.
globalThis.linkUiForeignReady = Promise.resolve(globalThis.linkUiForeignReady)
  .catch(() => {})
  .then(() => mountForeignDevMode({ layout }));
