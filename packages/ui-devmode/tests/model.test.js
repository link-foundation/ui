/**
 * The model of dev mode: the outline, the property rows, and the edits,
 * which only ever write the `session` and `user` layers the policy allows.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { createStore } from '@link-foundation/ui-store';
import { parseDevModePolicy } from '../src/index.js';
import {
  applyEdit,
  buildOutline,
  DevModeError,
  discardSession,
  editorFor,
  editValues,
  flattenOutline,
  formatValues,
  isLocked,
  propertyRows,
  resetProperty,
  saveSession,
  topWritableLayer,
} from '../src/model.js';
import { POLICY, sample } from './setup.js';

const policy = parseDevModePolicy(POLICY);

/** The sample as the site layer of a configuration, and its edit options. */
function setup(withPolicy = policy, text = sample('document')) {
  const doc = parse(text);
  const config = createConfig({ document: doc });
  const store = createStore({ document: doc });
  const options = {
    policy: withPolicy,
    document: store,
    parentOf: (id) => store.parentOf(id),
  };
  const row = (id, name) =>
    propertyRows(store.get(id), config, options).find((r) => r.name === name);
  return { config, store, options, row };
}

/** The `code` of the DevModeError a function throws. */
function errorCode(run) {
  try {
    run();
  } catch (error) {
    expect(error instanceof DevModeError).toBe(true);
    return error.code;
  }
  return null;
}

describe('outline', () => {
  it('is app > body > greeting, ok for a store and a document', () => {
    const expected = [
      {
        id: 'app',
        type: 'document',
        children: [
          {
            id: 'body',
            type: 'stack',
            children: [
              { id: 'greeting', type: 'text', children: [] },
              { id: 'ok', type: 'button', children: [] },
            ],
          },
        ],
      },
    ];
    const text = sample('document');
    expect(buildOutline(createStore({ text }))).toEqual(expected);
    expect(buildOutline(parse(text))).toEqual(expected);
    expect(
      flattenOutline(expected).map(
        ({ node, level, parent }) => `${level}:${node.id}<${parent}`
      )
    ).toEqual(['1:app<null', '2:body<app', '3:greeting<body', '3:ok<body']);
  });
});

describe('property rows', () => {
  it('lists the properties of ok with their layer and editor', () => {
    const { config, store, options } = setup();
    const rows = propertyRows(store.get('ok'), config, options);
    expect(rows.map((r) => [r.name, r.editor, r.text, r.layer])).toEqual([
      ['label', 'string', 'OK', 'site'],
      ['variant', 'enum', 'filled', 'site'],
      ['icon', 'string', '', 'defaults'],
      ['type', 'enum', '', 'defaults'],
      ['disabled', 'boolean', '', 'defaults'],
      ['style', 'string', '', 'defaults'],
      ['on', 'readonly', 'press (navigate home)', 'site'],
    ]);
    expect(rows.find((r) => r.name === 'variant').options).toEqual([
      'filled',
      'tonal',
      'outlined',
      'text',
    ]);
    expect(rows.every((r) => !r.changed && !r.locked)).toBe(true);
    expect(rows.find((r) => r.name === 'on').writable).toBe(false);
  });

  it('has the typed editors', () => {
    expect(editorFor('string', ['a']).editor).toBe('string');
    expect(editorFor('number', ['1']).editor).toBe('number');
    const size = editorFor('dimension', ['8px']);
    expect(size.editor).toBe('dimension');
    expect(size.units.includes('px')).toBe(true);
    expect(editorFor('duration', ['200ms']).units.includes('ms')).toBe(true);
    expect(editorFor('color', ['#fff']).editor).toBe('color');
    expect(editorFor(['enum', 'a', 'b'], ['a'])).toEqual({
      editor: 'enum',
      options: ['a', 'b'],
    });
    expect(editorFor(['enum', 'true', 'false'], []).editor).toBe('boolean');
    expect(editorFor('boolean', []).editor).toBe('boolean');
    expect(editorFor('element-ref-or-url', ['/a']).editor).toBe('string');
    expect(editorFor('dimension', [['token', 'space.medium']]).editor).toBe(
      'token'
    );
    expect(editorFor('action', []).editor).toBe('readonly');
  });

  it('formats values as Links Notation and reads edit values', () => {
    expect(formatValues(['Hello, links'])).toBe("'Hello, links'");
    expect(formatValues([['token', 'space.medium']])).toBe(
      '(token space.medium)'
    );
    expect(formatValues(undefined)).toBe('');
    expect(editValues('OK')).toEqual(['OK']);
    expect(editValues(2)).toEqual(['2']);
    expect(editValues(true)).toEqual(['true']);
    expect(editValues({ token: 'color.primary' })).toEqual([
      ['token', 'color.primary'],
    ]);
    expect(errorCode(() => editValues(undefined))).toBe('bad-value');
  });
});

describe('edits', () => {
  it('writes the session, saves to user, resets to site', () => {
    const { config, store, options, row } = setup();
    config.bindStore(store);
    const edit = applyEdit(
      config,
      { id: 'ok', name: 'label', value: 'Okay', layer: 'session' },
      options
    );
    expect(edit).toEqual({
      id: 'ok',
      name: 'label',
      key: null,
      layer: 'session',
      values: ['Okay'],
    });
    expect(row('ok', 'label').layer).toBe('session');
    expect(row('ok', 'label').changed).toBe(true);
    expect(store.get('ok').properties[0].values).toEqual(['Okay']);

    expect(saveSession(config, { policy })).toBe(1);
    expect(row('ok', 'label').layer).toBe('user');
    expect(config.overrides('session')).toEqual([]);

    expect(resetProperty(config, { id: 'ok', name: 'label' }, options)).toBe(
      'user'
    );
    expect(row('ok', 'label').layer).toBe('site');
    expect(row('ok', 'label').text).toBe('OK');
    expect(store.get('ok').properties[0].values).toEqual(['OK']);
    expect(resetProperty(config, { id: 'ok', name: 'label' }, options)).toBe(
      null
    );
  });

  it('resets the top writable layer first', () => {
    const { config, options, row } = setup();
    const set = (layer, value) =>
      applyEdit(config, { id: 'ok', name: 'label', value, layer }, options);
    set('user', 'Saved');
    set('session', 'Trying');
    expect(topWritableLayer(policy)).toBe('session');
    expect(resetProperty(config, { id: 'ok', name: 'label' }, options)).toBe(
      'session'
    );
    expect(row('ok', 'label').text).toBe('Saved');
  });

  it('discards the session', () => {
    const { config, options, row } = setup();
    applyEdit(config, { id: 'ok', name: 'variant', value: 'text' }, options);
    expect(row('ok', 'variant').layer).toBe('session');
    expect(discardSession(config)).toBe(1);
    expect(row('ok', 'variant').layer).toBe('site');
  });

  it('never writes the site, theme or defaults layer', () => {
    const { config, options } = setup();
    for (const layer of ['site', 'theme', 'defaults']) {
      expect(
        errorCode(() =>
          applyEdit(
            config,
            { id: 'ok', name: 'label', value: 'X', layer },
            options
          )
        )
      ).toBe('read-only-layer');
    }
    expect(config.overrides('site')).toEqual([]);
  });

  it('writes only the layers of the policy', () => {
    const sessionOnly = parseDevModePolicy(
      '(p: dev-mode (write-layers session))'
    );
    const { config, options } = setup(sessionOnly);
    const edit = { id: 'ok', name: 'label', value: 'X', layer: 'user' };
    expect(errorCode(() => applyEdit(config, edit, options))).toBe(
      'read-only-layer'
    );
    expect(errorCode(() => saveSession(config, { policy: sessionOnly }))).toBe(
      'read-only-layer'
    );
    const none = parseDevModePolicy('(p: dev-mode (write-layers))');
    expect(
      errorCode(() =>
        applyEdit(
          config,
          { ...edit, layer: undefined },
          { ...options, policy: none }
        )
      )
    ).toBe('read-only-layer');
  });

  it('keeps locked elements and their children read-only', () => {
    const locked = parseDevModePolicy('(p: dev-mode (locked-elements body))');
    const { config, store, options, row } = setup(locked);
    const parentOf = (id) => store.parentOf(id);
    expect(isLocked(locked, 'ok', parentOf)).toBe(true);
    expect(isLocked(locked, 'app', parentOf)).toBe(false);
    expect(row('ok', 'label').locked).toBe(true);
    expect(row('ok', 'label').writable).toBe(false);
    expect(
      errorCode(() =>
        applyEdit(config, { id: 'ok', name: 'label', value: 'X' }, options)
      )
    ).toBe('locked-element');
    expect(
      errorCode(() =>
        resetProperty(config, { id: 'ok', name: 'label' }, options)
      )
    ).toBe('locked-element');
    expect(config.overrides('session')).toEqual([]);
  });

  it('checks the value against the type of the property', () => {
    const { config, options } = setup();
    const edit = (name, value, id = 'ok') =>
      errorCode(() => applyEdit(config, { id, name, value }, options));
    expect(edit('variant', 'huge')).toBe('bad-value');
    expect(edit('disabled', 'maybe')).toBe('bad-value');
    expect(edit('label', '')).toBe('bad-value');
    expect(edit('on', 'press')).toBe('not-editable');
    expect(edit('label', 'X', 'missing')).toBe('unknown-element');
    expect(edit('disabled', true)).toBe(null);
    expect(edit('gap', { token: 'space.large' }, 'body')).toBe(null);
    expect(edit('padding', '12px', 'body')).toBe(null);
    expect(config.overrides('session').length).toBe(3);
  });
});
