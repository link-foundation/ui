/**
 * mountBehavior: machine services on ui-dom elements (start on mount, stop
 * on removal and destroy), keyboard and pointer input, and ui-action
 * handlers routed through the actions registry.
 */

import { describe, it, expect } from 'test-anywhere';
import { createManualClock } from '@link-foundation/ui-components/behavior';
import {
  BEHAVIOR_CSS,
  mountBehavior,
} from '@link-foundation/ui-components/behavior/dom';
import { createDom, microtasks, press } from '../support/dom.js';

const PAGE = `(page: document
  (bold: button (label Bold) (machine toggle-machine))
  (more: button (label Details) (machine disclosure-machine (content panel)))
  (panel: stack (t: text 'Hidden details')))`;

function mount(text = PAGE, options = {}) {
  const dom = createDom();
  const clock = createManualClock();
  const behavior = mountBehavior(dom.container, text, { clock, ...options });
  /** The focusable node of an element (the `<button>` of a button). */
  const target = (id) => {
    const node = behavior.handle.nodeFor(id);
    return node.querySelector('button') ?? node;
  };
  return { ...dom, clock, behavior, target };
}

describe('mountBehavior: the toggle machine', () => {
  it('starts a service for (machine toggle-machine) on mount', () => {
    const { behavior, target } = mount();
    expect(behavior.serviceFor('bold').state).toBe('off');
    expect(target('bold').getAttribute('aria-pressed')).toBe('false');
    expect(target('bold').dataset.part).toBe('root');
    expect(behavior.diagnostics).toEqual([]);
  });

  it('toggles with Enter, Space and a click', () => {
    const { behavior, target } = mount();
    const button = target('bold');
    const down = press(button, 'Enter');
    expect(down.defaultPrevented).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    press(button, ' ');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(behavior.serviceFor('bold').state).toBe('on');
  });

  it('passes element properties that the context has (disabled)', async () => {
    const { behavior, target } = mount();
    behavior.store.setProp('bold', 'disabled', ['true']);
    behavior.handle.flush();
    await microtasks();
    expect(behavior.serviceFor('bold').context.disabled).toBe(true);
    target('bold').click();
    expect(behavior.serviceFor('bold').state).toBe('off');
  });
});

describe('mountBehavior: the disclosure machine', () => {
  it('opens, moves focus to the content, closes and restores focus', () => {
    const { document, behavior, clock, target } = mount();
    const trigger = target('more');
    const panel = behavior.handle.nodeFor('panel');
    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.focus();
    press(trigger, 'Enter');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(panel);
    press(panel, 'Escape');
    expect(behavior.serviceFor('more').state).toBe('closing');
    expect(document.activeElement).toBe(trigger);
    expect(panel.hidden).toBe(false);
    clock.advance(500);
    expect(behavior.serviceFor('more').state).toBe('closed');
    expect(panel.hidden).toBe(true);
    expect(panel.dataset.state).toBe('closed');
  });

  it('adds the behaviour CSS so a hidden part stays hidden', () => {
    const { document } = mount();
    const css = [...document.querySelectorAll('style')]
      .map((s) => s.textContent)
      .join('\n');
    expect(css.includes(BEHAVIOR_CSS.trim().split('\n')[1])).toBe(true);
  });
});

describe('mountBehavior: service lifetime', () => {
  it('stops the service when its element is removed', async () => {
    const { behavior, clock } = mount();
    const service = behavior.serviceFor('more');
    service.send('open');
    service.send('close');
    expect(clock.pending()).toBe(1);
    behavior.store.remove('more');
    behavior.handle.flush();
    await microtasks();
    expect(behavior.serviceFor('more')).toBe(null);
    expect(service.status).toBe('stopped');
    expect(clock.pending()).toBe(0);
  });

  it('starts a service for an element added later', async () => {
    const { behavior } = mount('(page: document (a: text Hi))');
    behavior.store.setProp('a', 'machine', ['toggle-machine']);
    behavior.handle.flush();
    await microtasks();
    expect(behavior.serviceFor('a').state).toBe('off');
  });

  it('stops every service on destroy', () => {
    const { behavior, container } = mount();
    const services = ['bold', 'more'].map((id) => behavior.serviceFor(id));
    behavior.destroy();
    expect(services.map((s) => s.status)).toEqual(['stopped', 'stopped']);
    expect(behavior.serviceFor('bold')).toBe(null);
    expect(container.children.length).toBe(0);
  });

  it('runs a machine defined in the document', () => {
    const { behavior, target } = mount(`(page: document
  (flip: machine
    (initial a)
    (state a (on press (target b)))
    (state b (on press (target a)))
    (part root (attr data-side (state)) (on press press)))
  (x: button (label X) (machine flip)))`);
    expect(behavior.diagnostics).toEqual([]);
    target('x').click();
    expect(behavior.serviceFor('x').state).toBe('b');
    expect(target('x').dataset.side).toBe('b');
  });

  it('reports an unknown machine', () => {
    const { behavior } = mount('(page: document (a: button (machine nope)))');
    expect(behavior.diagnostics.map((d) => [d.code, d.at])).toEqual([
      ['unknown-machine', { element: 'a', machine: 'nope' }],
    ]);
  });
});

describe('mountBehavior: ui-action through the registry', () => {
  it('dispatches handler actions to registered functions', () => {
    const calls = [];
    const { target } = mount(
      '(page: document (b: button (label Save) (on press (emit saved) (save draft))))',
      { actions: { save: (args, meta) => calls.push([args, meta.source]) } }
    );
    const emitted = [];
    target('b').ownerDocument.addEventListener('ui-emit', (e) =>
      emitted.push(e.detail.event)
    );
    target('b').click();
    expect(calls).toEqual([[['draft'], 'b']]);
    expect(emitted).toEqual(['saved']);
  });

  it('set and toggle change element properties through the store', async () => {
    const { behavior, target } = mount(
      '(page: document (b: button (label Go) (on press (toggle panel open))) (panel: stack (open false)))'
    );
    target('b').click();
    expect(behavior.store.get('panel').properties).toEqual([
      { name: 'open', values: ['true'] },
    ]);
    await microtasks();
  });

  it("reports (on press 'alert(1)') as unknown-action and runs nothing", () => {
    const { behavior, target } = mount(
      "(page: document (bad: button (label Bad) (on press 'alert(1)')))"
    );
    const fired = [];
    target('bad').addEventListener('ui-action', (e) => fired.push(e));
    target('bad').click();
    expect(fired).toEqual([]);
    const unknown = behavior.diagnostics.filter(
      (d) => d.code === 'unknown-action'
    );
    expect(unknown.map((d) => d.at)).toEqual([
      { element: 'bad', action: 'alert(1)' },
    ]);
  });

  it('reports a handler action that is not registered', () => {
    const { behavior } = mount(
      '(page: document (b: button (label B) (on press (launch missiles))))'
    );
    expect(
      behavior.diagnostics
        .filter((d) => d.code === 'unknown-action' && d.at.action)
        .map((d) => d.at.action)
    ).toEqual(['launch']);
  });

  it('never navigates to javascript: URLs', () => {
    const navigated = [];
    const { behavior, target } = mount(
      "(page: document (go: button (label Go) (on press (navigate 'javascript:alert(1)'))))",
      { host: { navigate: (url) => navigated.push(url) } }
    );
    target('go').click();
    expect(navigated).toEqual([]);
    expect(behavior.diagnostics.some((d) => d.code === 'unsafe-url')).toBe(
      true
    );
  });
});
