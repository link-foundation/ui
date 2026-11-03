import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import { parse, format } from '@link-foundation/ui-core';
import {
  createManualClock,
  createMachine,
  interpret,
} from '../../src/behavior/index.js';
import {
  createToastQueue,
  overlayController,
  SURFACE_MACHINE,
  TOOLTIP_MACHINE,
  TABS_MACHINE,
  TOAST_MACHINE,
} from '../../src/overlays/index.js';
import { mount, microtasks, press } from './helpers.js';

for (const [name, machine] of Object.entries({
  surface: SURFACE_MACHINE,
  tooltip: TOOLTIP_MACHINE,
  tabs: TABS_MACHINE,
  toast: TOAST_MACHINE,
})) {
  test(`${name} LiNo machine matches its browser module`, () => {
    assert.equal(
      readFileSync(
        new URL(`../../src/overlays/machines/${name}.lino`, import.meta.url),
        'utf8'
      ),
      machine
    );
    assert.ok(createMachine(machine));
  });
}
test('tooltip uses injected time; leave cancels delay, content enter cancels close', () => {
  const clock = createManualClock();
  const service = interpret(TOOLTIP_MACHINE, { clock });
  service.send('enter');
  clock.advance(499);
  assert.equal(service.state, 'waiting');
  service.send('leave');
  clock.advance(1);
  assert.equal(service.state, 'closed');
  service.send('enter');
  clock.advance(500);
  assert.equal(service.state, 'open');
  service.send('leave');
  clock.advance(99);
  service.send('enter');
  clock.advance(1);
  assert.equal(service.state, 'open');
  service.send('close');
  assert.equal(service.state, 'closed');
  service.stop();
  assert.equal(clock.pending(), 0);
});
test('toast queue is bounded, pauses remaining time for both focus and hover, and drains', () => {
  const clock = createManualClock();
  const queue = createToastQueue({ max: 3, duration: 1000, clock });
  for (const id of ['a', 'b', 'c', 'd']) {
    queue.push(id);
  }
  assert.equal(queue.entries.get('d').service.state, 'queued');
  clock.advance(300);
  queue.pause('a', 'hover');
  queue.pause('a', 'focus');
  clock.advance(700);
  assert.equal(queue.entries.get('d').service.state, 'visible');
  queue.resume('a', 'hover');
  clock.advance(1000);
  assert.ok(queue.entries.has('a'));
  queue.resume('a', 'focus');
  clock.advance(699);
  assert.ok(queue.entries.has('a'));
  clock.advance(1);
  assert.equal(queue.entries.size, 0);
  queue.disconnect();
  assert.equal(clock.pending(), 0);
});
test('duration zero persists, close promotes the next toast, teardown clears timers', () => {
  const clock = createManualClock();
  const queue = createToastQueue({ max: 1, clock });
  queue.push('persist', { duration: 0 });
  queue.push('next');
  clock.advance(100000);
  assert.ok(queue.entries.has('persist'));
  queue.close('persist');
  assert.equal(queue.entries.get('next').service.state, 'visible');
  queue.disconnect();
  assert.equal(clock.pending(), 0);
});
test('every story parses, round trips, and has no unknown kind or property', () => {
  for (const kind of [
    'dialog',
    'alert-dialog',
    'popover',
    'tooltip',
    'menu',
    'menu-item',
    'menu-separator',
    'context-menu',
    'radial-menu',
    'tabs',
    'tab',
    'tab-panel',
    'toast',
    'toaster',
    'drawer',
  ]) {
    const text = readFileSync(
      new URL(`../../stories/${kind}.lino`, import.meta.url),
      'utf8'
    );
    const doc = parse(text);
    assert.deepEqual(doc.diagnostics, [], kind);
    assert.deepEqual(parse(format(doc)).roots, doc.roots, kind);
  }
});
test('tabs manual activation waits for Enter or Space and ARIA IDs pair', async () => {
  const app = await mount(`tabs: tabs
  activation manual
  one: tab
    label One
    panel first
  two: tab
    label Two
    panel second
  first: tab-panel
    text First
  second: tab-panel
    text Second
`);
  try {
    const one = app.node('one');
    const two = app.node('two');
    one.focus();
    press(one, 'ArrowRight');
    assert.equal(app.document.activeElement, two);
    assert.equal(one.getAttribute('aria-selected'), 'true');
    assert.equal(app.node('second').hidden, true);
    press(two, ' ');
    assert.equal(two.getAttribute('aria-selected'), 'true');
    assert.equal(app.node('second').hidden, false);
    assert.equal(two.getAttribute('aria-controls'), app.node('second').id);
    assert.equal(app.node('second').getAttribute('aria-labelledby'), two.id);
  } finally {
    app.dispose();
  }
});
test('long press opens only after threshold; motion and pointerup cancel', async () => {
  const clock = createManualClock();
  const app = await mount(
    `menu: context-menu
  anchor trigger
  copy: menu-item
    label Copy
`,
    { overlays: { clock, selection: () => ['other'] } }
  );
  try {
    const target = app.document.getElementById('trigger');
    const pointer = (type, x = 1) => {
      const event = new app.window.Event(type, { bubbles: true });
      Object.assign(event, { pointerType: 'touch', clientX: x, clientY: 1 });
      target.dispatchEvent(event);
    };
    pointer('pointerdown');
    clock.advance(599);
    assert.equal(overlayController(app.node('menu')).service.state, 'closed');
    pointer('pointerup');
    clock.advance(1);
    assert.equal(overlayController(app.node('menu')).service.state, 'closed');
    pointer('pointerdown');
    pointer('pointermove', 20);
    clock.advance(600);
    assert.equal(overlayController(app.node('menu')).service.state, 'closed');
    // Live browser coverage verifies the completed long press and placement.
    await microtasks();
  } finally {
    app.dispose();
  }
  assert.equal(clock.pending(), 0);
});

test('dialog action content closes through its handler and tears down nested renders', async () => {
  const actions = [];
  const app = await mount(
    `confirm: dialog
  title Confirm
  actions
    cancel: button
      label Cancel
      on press
        emit close
  on close
    emit closed
`,
    { onAction: (detail) => actions.push(detail) }
  );
  try {
    const node = app.node('confirm');
    // jsdom has no native dialog methods; exercise the documented fallback.
    const controller = overlayController(node);
    controller.open();
    node.querySelector('button').click();
    assert.equal(node.hidden, true);
    assert.deepEqual(
      actions.map((detail) => detail.action),
      [
        ['emit', 'close'],
        ['emit', 'closed'],
      ]
    );
    app.store.setProp('confirm', 'title', ['Updated']);
    app.handle.flush();
    assert.equal(node.querySelector('h2').textContent, 'Updated');
  } finally {
    app.dispose();
  }
});

test('rendered button anchors expose menu ARIA on the native button', async () => {
  const app = await mount(`launch: button
  label Actions
menu: menu
  anchor launch
  edit: menu-item
    label Edit
    icon edit
`);
  try {
    const button = app.node('launch').querySelector('button');
    assert.equal(button.getAttribute('aria-haspopup'), 'menu');
    assert.equal(button.getAttribute('aria-controls'), app.node('menu').id);
    assert.equal(
      app.node('edit').querySelector('ui-icon').getAttribute('name'),
      'edit'
    );
  } finally {
    app.dispose();
  }
});
