import { createStore } from '@link-foundation/ui-store';
import { createManualClock } from '../src/index.js';
export const makeStore = () =>
  createStore({ text: 'ok: button\n  label OK\n' });
export function fixture() {
  const store = makeStore();
  const clock = createManualClock();
  const root = new globalThis.EventTarget();
  const target = {
    type: 'text',
    value: '',
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
  };
  const handle = { idFor: () => 'ok' };
  const fire = (type, fields = {}) => {
    const event = new globalThis.Event(type);
    Object.defineProperty(event, 'target', { value: target });
    Object.assign(event, { clientX: 22, clientY: 28, ...fields });
    root.dispatchEvent(event);
  };
  return {
    store,
    clock,
    root,
    target,
    handle,
    fire,
    started: 0,
    seed: 42,
    viewport: [1280, 800],
  };
}
