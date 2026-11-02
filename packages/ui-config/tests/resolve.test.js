/**
 * createConfig: resolve, explain, set, unset, clear, loadLayer, importPatch
 * and effective.
 */

import { describe, it, expect } from 'test-anywhere';
import { format, parse } from '@link-foundation/ui-core';
import {
  ConfigError,
  createConfig,
  KEY_SEPARATOR,
  LAYERS,
  overrideKey,
} from '@link-foundation/ui-config';
import { appDocument, errorCode, fixture, recorded } from './helpers.js';

const patch = (layer, ...ops) =>
  `(p: overrides (layer ${layer}) (base app) ${ops.join(' ')})`;

/** A config with `(ok margin <layer>)` in every layer. */
function everyLayer() {
  const config = createConfig({ document: appDocument() });
  for (const layer of ['defaults', 'theme', 'site']) {
    expect(
      config.loadLayer(layer, patch(layer, `(set ok margin ${layer})`)).ok
    ).toBe(true);
  }
  config.set('user', 'ok', 'margin', ['user']);
  config.set('session', 'ok', 'margin', ['session']);
  return config;
}

describe('createConfig: layers', () => {
  it('orders the five layers and keys overrides by id, name and key', () => {
    expect(LAYERS).toEqual(['defaults', 'theme', 'site', 'user', 'session']);
    expect(KEY_SEPARATOR).toBe('\u0000');
    expect(overrideKey('m', 'token', 'a.b')).toBe('m\u0000token\u0000a.b');
    expect(overrideKey('ok', 'label')).toBe('ok\u0000label\u0000');
  });

  it('resolves the highest layer, falling back as layers are cleared', () => {
    const config = everyLayer();
    expect(config.explain('ok', 'margin')).toEqual(
      LAYERS.map((layer) => ({ layer, value: [layer] }))
    );
    for (const layer of [...LAYERS].reverse()) {
      expect(config.resolve('ok', 'margin')).toEqual({
        layer,
        value: [layer],
      });
      config.clear(layer);
    }
    expect(config.resolve('ok', 'margin')).toBeUndefined();
    expect(config.explain('ok', 'margin')).toEqual([]);
  });

  it('counts the values of the document as the site layer', () => {
    const config = createConfig({ document: appDocument() });
    expect(config.base).toBe('app');
    expect(config.resolve('greeting', 'text')).toEqual({
      layer: 'site',
      value: ['Hello, links'],
    });
    expect(config.resolve('ok', 'label')).toEqual({
      layer: 'site',
      value: ['OK'],
    });
    config.loadLayer('theme', fixture('theme.lino'));
    expect(config.explain('ok', 'variant')).toEqual([
      { layer: 'theme', value: ['outlined'] },
      { layer: 'site', value: ['filled'] },
    ]);
    config.loadLayer('site', fixture('site.lino'));
    expect(config.resolve('ok', 'variant')).toEqual({
      layer: 'site',
      value: ['text'],
    });
    expect(config.valueIn('site', 'body', 'gap')).toEqual([
      ['token', 'space.large'],
    ]);
  });
});

describe('createConfig: edits', () => {
  it('edits only the user and session layers', () => {
    const config = createConfig({ document: appDocument() });
    for (const layer of ['defaults', 'theme', 'site']) {
      expect(errorCode(() => config.set(layer, 'ok', 'label', ['x']))).toBe(
        'read-only-layer'
      );
      expect(errorCode(() => config.unset(layer, 'ok', 'label'))).toBe(
        'read-only-layer'
      );
    }
    expect(errorCode(() => config.set('cloud', 'ok', 'label', ['x']))).toBe(
      'unknown-layer'
    );
    config.set('user', 'ok', 'label', ['Save']);
    expect(config.resolve('ok', 'label')).toEqual({
      layer: 'user',
      value: ['Save'],
    });
    config.unset('user', 'ok', 'label');
    expect(config.resolve('ok', 'label').layer).toBe('site');
    expect(new ConfigError('bad-value', 'm').code).toBe('bad-value');
  });

  it('checks ids, keys and values', () => {
    const config = createConfig({ document: appDocument() });
    expect(errorCode(() => config.set('user', 'nope', 'label', ['x']))).toBe(
      'unknown-id'
    );
    expect(
      errorCode(() => config.set('user', 'material3', 'token', ['x']))
    ).toBe('missing-key');
    expect(errorCode(() => config.set('user', 'ok', 'label', []))).toBe(
      'bad-value'
    );
    expect(errorCode(() => config.set('user', 'ok', 'label', 'x'))).toBe(
      'bad-value'
    );
    expect(errorCode(() => config.set('user', 'ok', 'label', [1]))).toBe(
      'bad-value'
    );
    expect(config.resolve('nope', 'label')).toBeUndefined();
    expect(config.explain('material3', 'token')).toEqual([]);
  });

  it('changes only the token with the given key', () => {
    const config = createConfig({ document: appDocument() });
    config.importPatch(
      patch('user', "(set material3 token color.primary '#00639B')")
    );
    expect(config.resolve('material3', 'token', 'color.primary')).toEqual({
      layer: 'user',
      value: ['#00639B'],
    });
    expect(config.resolve('material3', 'token', 'color.on-primary')).toEqual({
      layer: 'site',
      value: ['#FFFFFF'],
    });
    const tokens = config
      .effective()
      .byId.get('material3')
      .properties.filter((p) => p.name === 'token');
    expect(tokens.map((p) => p.values)).toEqual([
      ['color.primary', '#00639B'],
      ['color.on-primary', '#FFFFFF'],
      ['space.medium', '16px'],
      ['shape.corner.medium', '12px'],
      ['motion.duration.short', '150ms'],
    ]);
  });

  it('honours custom keyed props and a kind used as a name', () => {
    const document = parse('(s: text small (style big red))');
    const config = createConfig({ document, keyedProps: ['style'] });
    expect(config.keyedProps).toEqual(['style']);
    config.set('user', 's', 'text', ['tiny']);
    expect(config.resolve('s', 'text')).toEqual({
      layer: 'user',
      value: ['tiny'],
    });
    expect(config.resolve('s', 'style', 'big')).toEqual({
      layer: 'site',
      value: ['red'],
    });
    expect(config.resolve('s', 'style', 'small')).toBeUndefined();
    expect(
      config.importPatch(patch('user', '(set s style small blue)')).ok
    ).toBe(true);
    expect(format(config.effective(), { style: 'inline' })).toBe(
      '(s: text tiny (style big red) (style small blue))\n'
    );
  });

  it('gives the base document with all layers applied', () => {
    const document = appDocument();
    const before = format(document);
    const config = createConfig({ document });
    config.loadLayer('site', fixture('site.lino'));
    config.loadLayer('user', fixture('user.lino'));
    config.set('session', 'ok', 'label', ['Go']);
    const doc = config.effective();
    expect(format(document)).toBe(before);
    expect(doc.byId.get('greeting').positional).toEqual(['Hello, agents']);
    expect(doc.byId.get('ok').properties).toEqual([
      { name: 'label', values: ['Go'] },
      { name: 'variant', values: ['text'] },
      { name: 'on', values: ['press', ['navigate', 'home']] },
    ]);
    expect(doc.byId.get('body').properties).toEqual([
      { name: 'direction', values: ['vertical'] },
      { name: 'gap', values: [['token', 'space.large']] },
      { name: 'padding', values: ['16px'] },
    ]);
    expect(
      doc.byId
        .get('material3')
        .properties.filter((p) => p.values[0]?.startsWith?.('color.'))
    ).toEqual([
      { name: 'token', values: ['color.primary', '#00639B'] },
      { name: 'token', values: ['color.on-primary', '#FFFFFF'] },
      { name: 'token', values: ['color.secondary', '#625B71'] },
    ]);
  });
});

describe('createConfig: patches and events', () => {
  it('loads a layer as a whole and imports patches on top', () => {
    const config = createConfig({ document: appDocument() });
    const calls = recorded(config);
    expect(config.loadLayer('user', fixture('user.lino'))).toEqual({
      ok: true,
      diagnostics: [],
    });
    expect(calls.length).toBe(1);
    expect(calls[0].map((e) => [e.layer, e.id, e.name, e.key])).toEqual([
      ['user', 'greeting', 'text', null],
      ['user', 'body', 'padding', null],
      ['user', 'material3', 'token', 'color.primary'],
    ]);
    expect(calls[0][0]).toEqual({
      layer: 'user',
      id: 'greeting',
      name: 'text',
      key: null,
      mode: 'positional',
      before: null,
      after: ['Hello, agents'],
    });
    config.importPatch(
      patch('user', '(unset body padding)', '(set ok label Yes)')
    );
    expect(config.overrides('user').map((o) => `${o.id} ${o.name}`)).toEqual([
      'greeting text',
      'material3 token',
      'ok label',
    ]);
    config.loadLayer('user', patch('user', '(set ok label No)'));
    expect(config.overrides('user').map((o) => o.values)).toEqual([['No']]);
    expect(calls.length).toBe(3);
  });

  it('imports into the layer of the patch or the one given', () => {
    const config = createConfig({ document: appDocument() });
    const result = config.importPatch(
      patch('user', '(set ok label A)'),
      'session'
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['layer-mismatch']);
    expect(config.resolve('ok', 'label').layer).toBe('session');
    expect(
      config.importPatch('(p: overrides (set ok label B))').diagnostics[0].code
    ).toBe('missing-layer');
    expect(
      config.importPatch(patch('site', '(set ok label B)')).diagnostics[0].code
    ).toBe('read-only-layer');
    expect(errorCode(() => config.importPatch(patch('user'), 'site'))).toBe(
      'read-only-layer'
    );
    const other = '(p: overrides (layer user) (base other) (set ok label C))';
    expect(config.importPatch(other).diagnostics.map((d) => d.code)).toEqual([
      'base-mismatch',
    ]);
  });
});

describe('createConfig: invalid patches and events', () => {
  it('changes nothing for patches over the limits or with unknown ids', () => {
    const config = createConfig({
      document: appDocument(),
      maxPatchOps: 2,
      maxPatchSize: 200,
    });
    config.set('user', 'ok', 'label', ['Kept']);
    const calls = recorded(config);
    const cases = [
      [patch('user', '(set ok label A)', '(set nope label B)'), 'unknown-id'],
      [
        patch('user', '(set ok label A)', '(set ok gap 1)', '(set ok pad 2)'),
        'too-many-ops',
      ],
      [patch('user', `(set ok label '${'x'.repeat(200)}')`), 'patch-too-large'],
      [patch('user', '(set material3 token)'), 'missing-key'],
      [patch('user', '(set ok label A)', '(jump ok)'), 'unknown-op'],
    ];
    for (const [text, code] of cases) {
      for (const result of [
        config.importPatch(text),
        config.loadLayer('user', text),
        config.loadLayer('site', text),
      ]) {
        expect(result.ok).toBe(false);
        expect(result.diagnostics.map((d) => d.code)).toContain(code);
      }
    }
    expect(calls).toEqual([]);
    expect(config.overrides('user').map((o) => o.values)).toEqual([['Kept']]);
    expect(config.overrides('site')).toEqual([]);
  });

  it('emits one call per change, none for no-ops, and survives listener errors', () => {
    const errors = [];
    const config = createConfig({
      document: appDocument(),
      onListenerError: (error) => errors.push(error.message),
    });
    config.subscribe(() => {
      throw new Error('boom');
    });
    const calls = recorded(config);
    config.set('user', 'ok', 'label', ['A']);
    config.set('user', 'ok', 'label', ['A']);
    config.unset('session', 'ok', 'label');
    config.clear('session');
    config.set('session', 'ok', 'label', ['B']);
    config.clear('user');
    expect(
      calls.map((events) => events.map((e) => [e.layer, e.before, e.after]))
    ).toEqual([
      [['user', null, ['A']]],
      [['session', null, ['B']]],
      [['user', ['A'], null]],
    ]);
    expect(errors).toEqual(['boom', 'boom', 'boom']);
    const stop = config.subscribe(() => calls.push('extra'));
    stop();
    config.set('user', 'ok', 'label', ['C']);
    expect(calls.includes('extra')).toBe(false);
  });

  it('loads the layers given to createConfig, lowest first', () => {
    const config = createConfig({
      document: appDocument(),
      layers: {
        user: fixture('user.lino'),
        theme: fixture('theme.lino'),
        site: fixture('site.lino'),
      },
    });
    expect(config.explain('body', 'padding')).toEqual([
      { layer: 'theme', value: ['4px'] },
      { layer: 'site', value: ['8px'] },
      { layer: 'user', value: ['16px'] },
    ]);
    expect(
      errorCode(() =>
        createConfig({ document: appDocument(), layers: { cloud: '' } })
      )
    ).toBe('unknown-layer');
    let error;
    try {
      createConfig({
        document: appDocument(),
        layers: { site: patch('site', '(set nope label A)') },
      });
    } catch (e) {
      error = e;
    }
    expect(error.code).toBe('bad-patch');
    expect(error.diagnostics.map((d) => d.code)).toEqual(['unknown-id']);
  });

  it('needs a document', () => {
    expect(errorCode(() => createConfig({}))).toBe('bad-document');
    const config = createConfig({
      document: { roots: parse('(a: text x)').roots },
    });
    expect(config.resolve('a', 'text').value).toEqual(['x']);
  });
});
