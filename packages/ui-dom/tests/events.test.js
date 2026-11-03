/**
 * Behaviour: `(on press (navigate home))` dispatches a `ui-action` event
 * and calls onAction with data; nothing is ever evaluated.
 */

import { describe, it, expect } from 'test-anywhere';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { mountDocument } from '@link-foundation/ui-dom';
import { bindHandlers } from '../src/events.js';
import { createDom, sample } from './setup-dom.js';

const EXPECTED = { source: 'ok', event: 'press', action: ['navigate', 'home'] };

function mountWithActions(text) {
  const dom = createDom();
  const actions = [];
  const diagnostics = [];
  const mounted = mountDocument(dom.container, text, {
    onAction: (detail) => actions.push(detail),
    onDiagnostic: (d) => diagnostics.push(d.code),
  });
  return { ...dom, ...mounted, actions, codes: diagnostics };
}

/** Every attribute name in the subtree. */
const attributeNames = (root) =>
  [root, ...root.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes].map((a) => a.name)
  );

describe('events', () => {
  it('maps press to a click of the native button and calls onAction', () => {
    const { handle, actions } = mountWithActions(sample('document'));
    handle.nodeFor('ok').querySelector('button').click();
    expect(actions).toEqual([EXPECTED]);
    expect(Object.isFrozen(actions[0])).toBe(true);
  });

  it('dispatches a bubbling, composed ui-action CustomEvent', () => {
    const { window, document, handle } = mountWithActions(sample('document'));
    const seen = [];
    document.body.addEventListener('ui-action', (event) => seen.push(event));
    handle.nodeFor('ok').querySelector('button').click();
    expect(seen.length).toBe(1);
    const [event] = seen;
    expect(event instanceof window.CustomEvent).toBe(true);
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(handle.nodeFor('ok'));
    expect(event.detail).toEqual(EXPECTED);
  });

  it('does not act while the button is disabled', () => {
    const { handle, actions } = mountWithActions(
      "(b: button 'Go' (disabled true) (on press (emit go)))"
    );
    handle.nodeFor('b').querySelector('button').click();
    expect(actions).toEqual([]);
  });

  it('reports the current ID after a rename', () => {
    const { store, handle, actions } = mountWithActions(sample('document'));
    store.rename('ok', 'confirm');
    handle.flush();
    handle.nodeFor('confirm').querySelector('button').click();
    expect(actions[0].source).toBe('confirm');
  });

  it('rebinds when the handler changes and unbinds on remove', () => {
    const { store, handle, actions } = mountWithActions(sample('document'));
    const button = handle.nodeFor('ok').querySelector('button');
    store.setProp('ok', 'on', ['press', ['emit', 'saved']]);
    handle.flush();
    button.click();
    expect(actions.map((a) => a.action)).toEqual([['emit', 'saved']]);
    store.remove('ok');
    handle.flush();
    button.click();
    expect(actions.length).toBe(1);
  });

  it('dispatches one event per action, in order', () => {
    const { handle, actions } = mountWithActions(
      "(b: button 'Go' (on press (emit started) (navigate next)))"
    );
    handle.nodeFor('b').querySelector('button').click();
    expect(actions.map((a) => a.action)).toEqual([
      ['emit', 'started'],
      ['navigate', 'next'],
    ]);
  });

  it('never executes a value, and writes no on* attributes', () => {
    const { window, handle, actions, codes, container } =
      mountWithActions(`(s: stack
  (a: button 'alert(1)' (on press 'alert(1)'))
  (b: button 'B' (on press (navigate 'javascript:alert(1)')))
  (c: button 'C' (on press (alert 1)))
  (d: text 'alert(1)')
  (e: image 'javascript:alert(1)' (alt x)))`);
    let alerted = 0;
    window.alert = () => {
      alerted += 1;
    };
    for (const id of ['a', 'b', 'c']) {
      handle.nodeFor(id).querySelector('button').click();
    }
    expect(alerted).toBe(0);
    expect(actions).toEqual([]);
    expect(codes).toContain('invalid-handler');
    expect(codes).toContain('unsafe-url');
    expect(codes).toContain('unknown-action');
    expect(handle.nodeFor('d').textContent).toBe('alert(1)');
    expect(handle.nodeFor('e').querySelector('img').hasAttribute('src')).toBe(
      false
    );
    expect(attributeNames(container).some((n) => n.startsWith('on'))).toBe(
      false
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('dispatches the actions an isAction option knows, and no others', () => {
    const { container } = createDom();
    const actions = [];
    const diagnostics = [];
    const { handle } = mountDocument(
      container,
      "(b: button 'B' (on press (save draft) (launch x) (navigate home)))",
      {
        isAction: (name) => name === 'save',
        onAction: (detail) => actions.push(detail.action),
        onDiagnostic: (d) => diagnostics.push(d),
      }
    );
    handle.nodeFor('b').querySelector('button').click();
    expect(actions).toEqual([['save', 'draft']]);
    expect(
      diagnostics
        .filter((d) => d.code === 'unknown-action' && d.at.action)
        .map((d) => d.at.action)
    ).toEqual(['launch', 'navigate']);
  });

  it('reports an event the renderer does not map', () => {
    const { codes } = mountWithActions("(b: button 'B' (on swipe (emit x)))");
    expect(codes).toContain('unknown-event');
  });

  it('uses neither eval nor new Function in src/', () => {
    const src = fileURLToPath(new URL('../src/', import.meta.url));
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else {
          files.push(path);
        }
      }
    };
    walk(src);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(/eval\(|new Function/.test(text)).toBe(false);
    }
  });
});

it('resolves data-event item parameters using only safe own properties', () => {
  const { document, window, container } = createDom();
  const node = document.createElement('div');
  container.append(node);
  const actions = [];
  const unbind = bindHandlers(
    node,
    node,
    [
      {
        event: 'select',
        domEvent: 'ui-select',
        actions: [
          [
            'emit',
            'chosen',
            ...[
              'id',
              'profile.name',
              '__proto__',
              'constructor',
              'inherited',
            ].map((path) => ['param', `item.${path}`]),
          ],
        ],
      },
    ],
    { idFor: () => 'rows', onAction: (detail) => actions.push(detail) }
  );
  const item = Object.assign(Object.create({ inherited: 'hidden' }), {
    id: 'row-1',
    profile: { name: 'Alice' },
  });
  node.dispatchEvent(new window.CustomEvent('ui-select', { detail: { item } }));
  expect(actions[0].event).toBe('select');
  expect(actions[0].action).toEqual([
    'emit',
    'chosen',
    'row-1',
    'Alice',
    undefined,
    undefined,
    undefined,
  ]);
  expect(Object.isFrozen(actions[0].action)).toBe(true);
  unbind();
});

it('rejects unsafe navigation after resolving an item parameter', () => {
  const { document, window } = createDom();
  const node = document.createElement('div');
  const actions = [];
  const codes = [];
  const unbind = bindHandlers(
    node,
    node,
    [
      {
        event: 'activate',
        domEvent: 'ui-activate',
        actions: [['navigate', ['param', 'item.url']]],
      },
    ],
    {
      idFor: () => 'rows',
      onAction: (detail) => actions.push(detail),
      diagnostic: (code) => codes.push(code),
    }
  );
  node.dispatchEvent(
    new window.CustomEvent('ui-activate', {
      detail: { item: { url: 'javascript:alert(1)' } },
    })
  );
  expect(actions).toEqual([]);
  expect(codes).toEqual(['unsafe-url']);
  unbind();
});
