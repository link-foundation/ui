/**
 * Actions: a `ui-action` of the view calls `onAction` with the ui-dom
 * detail and the matching host function; unknown actions only warn.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import { UiProvider, UiView, useUiAction } from '@link-foundation/ui-react';
import { createActionRegistry } from '@link-foundation/ui-react/hooks';
import { click, h, mount } from './setup-dom.js';

const doc = (action) =>
  `(app: document (body: stack (ok: button (label 'OK') (on press ${action}))))`;

/** Collect console.warn messages while `fn` runs. */
async function warnings(fn) {
  const messages = [];
  const original = console.warn;
  console.warn = (...args) => messages.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return messages;
}

/** The native button of `ok` (the target of its press listener). */
const okOf = (view) =>
  view.container.querySelector('[data-link-id="ok"] > button');

describe('UiView actions', () => {
  it('clicking ok calls actions.save once and onAction with the detail', async () => {
    const saves = [];
    const details = [];
    const view = await mount(
      h(UiView, {
        source: doc('(emit save)'),
        actions: { save: (detail, event) => saves.push({ detail, event }) },
        onAction: (detail) => details.push(detail),
      })
    );
    await click(okOf(view));
    expect(saves.length).toBe(1);
    expect(details).toEqual([
      { source: 'ok', event: 'press', action: ['emit', 'save'] },
    ]);
    expect(Object.isFrozen(details[0])).toBe(true);
    expect(saves[0].detail).toBe(details[0]);
    expect(saves[0].event.type).toBe('ui-action');
    await view.unmount();
  });

  it('calls the handler of the action head, with the latest props', async () => {
    const calls = [];
    const props = (tag) => ({
      source: doc('(navigate home)'),
      actions: { navigate: (d) => calls.push([tag, d.action[1]]) },
    });
    const view = await mount(h(UiView, props('first')));
    await view.rerender(h(UiView, props('second')));
    await click(okOf(view));
    expect(calls).toEqual([['second', 'home']]);
    await view.unmount();
  });

  it('looks up the actions of the view, then of the provider', async () => {
    const calls = [];
    const store = createStore({ text: doc('(emit save) (emit load)') });
    function Saver() {
      useUiAction('save', () => calls.push('hook save'));
      return null;
    }
    const view = await mount(
      h(
        UiProvider,
        { actions: { load: () => calls.push('provider load') } },
        h(UiView, {
          store,
          actions: { save: () => calls.push('view save') },
        }),
        h(Saver)
      )
    );
    await click(okOf(view));
    // Saver registers on the provider: the view's own actions win.
    expect(calls).toEqual(['view save', 'provider load']);
    await view.unmount();
  });

  it('accepts a registry with has and dispatch', async () => {
    const calls = [];
    const registry = {
      has: (name) => name === 'save',
      dispatch: (name, args, meta) =>
        calls.push([name, args, meta.detail.source]),
    };
    const view = await mount(
      h(UiView, { source: doc('(emit save draft)'), actions: registry })
    );
    await click(okOf(view));
    expect(calls).toEqual([['save', ['draft'], 'ok']]);
    await view.unmount();
  });

  it('unknown actions only warn', async () => {
    const codes = [];
    const details = [];
    const messages = await warnings(async () => {
      const view = await mount(
        h(UiView, {
          source: doc('(emit missing)'),
          actions: { save: () => {} },
          onAction: (d) => details.push(d),
        })
      );
      await click(okOf(view));
      await view.unmount();

      // `(save)` is not a vocabulary action: ui-dom reports it and binds
      // nothing, so a click does nothing.
      const undeclared = await mount(
        h(UiView, {
          source: doc('(save)'),
          actions: { save: () => details.push('called') },
          onDiagnostic: (d) => codes.push(d.code),
        })
      );
      await click(okOf(undeclared));
      await undeclared.unmount();
    });
    expect(details.length).toBe(1);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('(emit missing)');
    expect(codes).toContain('unknown-action');
  });

  it('stays silent without any actions and in production', async () => {
    const messages = await warnings(async () => {
      const view = await mount(h(UiView, { source: doc('(emit save)') }));
      await click(okOf(view));
      await view.unmount();
      const registry = createActionRegistry();
      registry.setActions({});
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        registry.dispatch({ source: 'ok', event: 'press', action: ['x'] });
      } finally {
        process.env.NODE_ENV = env;
      }
    });
    expect(messages).toEqual([]);
  });

  it('handles only the actions of its own nodes (nested views)', async () => {
    const outer = [];
    const inner = [];
    function Nested() {
      return h(UiView, {
        source: doc('(emit inner)'),
        actions: { inner: () => inner.push(1) },
      });
    }
    const view = await mount(
      h(UiView, {
        source: '(app: document (body: stack (slot: nested)))',
        components: { nested: Nested },
        onAction: (d) => outer.push(d),
      })
    );
    const ok = view.container.querySelector(
      'ui-react-host [data-link-id="ok"] > button'
    );
    await click(ok);
    expect(inner).toEqual([1]);
    expect(outer).toEqual([]);
    await view.unmount();
  });
});
