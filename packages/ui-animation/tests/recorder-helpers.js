import { createStore } from '@link-foundation/ui-store';
import { JSDOM } from 'jsdom';
import { createManualClock } from '../src/index.js';
// Keep events and targets in one realm even when another Bun suite sets globals.
const { window } = new JSDOM();
export const makeStore = () =>
  createStore({ text: 'ok: button\n  label OK\n' });
export function fixture() {
  const store = makeStore();
  const clock = createManualClock();
  const root = window.document.createElement('div');
  const target = window.document.createElement('input');
  target.getBoundingClientRect = () => ({ left: 10, top: 20 });
  root.append(target);
  const handle = { idFor: () => 'ok' };
  const fire = (type, fields = {}) => {
    const event = new window.Event(type, { bubbles: true });
    Object.assign(event, { clientX: 22, clientY: 28, ...fields });
    target.dispatchEvent(event);
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
