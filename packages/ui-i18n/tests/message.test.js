/**
 * The `message` value type: `(t KEY)` and `(t KEY (PARAM VALUE) ...)`.
 */

import { describe, it, expect } from 'test-anywhere';
import { format, parse } from '@link-foundation/ui-core';
import {
  i18nVocabulary,
  isMessage,
  message,
  messageRaw,
  parseMessage,
  typeValue,
} from '@link-foundation/ui-i18n';

describe('parseMessage', () => {
  it('reads keys and params, numbers typed', () => {
    expect(parseMessage(['t', 'ui.dialog.close'])).toEqual({
      type: 'message',
      key: 'ui.dialog.close',
      params: {},
    });
    expect(
      parseMessage(['t', 'files', ['count', '3'], ['name', 'Ada']])
    ).toEqual(message('files', { count: 3, name: 'Ada' }));
    expect(parseMessage(['t', 'a', ['b', ['t', 'c']]]).params.b).toEqual(
      message('c')
    );
  });

  it('is undefined for other values and null for malformed messages', () => {
    expect(parseMessage('t')).toBeUndefined();
    expect(parseMessage(['label', 'x'])).toBeUndefined();
    expect(parseMessage(['t'])).toBeNull();
    expect(parseMessage(['t', ['a']])).toBeNull();
    expect(parseMessage(['t', 'k', 'x'])).toBeNull();
    expect(parseMessage(['t', 'k', ['p', ['x', 'y']]])).toBeNull();
  });

  it('round-trips through messageRaw', () => {
    const value = message('a', { n: 5, b: message('c') });
    expect(isMessage(value)).toBe(true);
    expect(messageRaw(value)).toEqual([
      't',
      'a',
      ['n', '5'],
      ['b', ['t', 'c']],
    ]);
    expect(parseMessage(messageRaw(value))).toEqual(value);
  });
});

describe('typeValue', () => {
  it('types messages and defers the rest to ui-core', () => {
    expect(typeValue(['t', 'ok.label'], { type: 'string' })).toEqual({
      value: message('ok.label'),
      diagnostics: [],
    });
    expect(typeValue('OK', { type: 'string' }).value).toEqual({
      type: 'string',
      value: 'OK',
    });
    const bad = typeValue(['t'], { type: 'string' }, { at: { element: 'ok' } });
    expect(bad.value).toBeNull();
    expect(bad.diagnostics[0].code).toBe('invalid-value');
    expect(bad.diagnostics[0].expected).toBe('message');
    expect(bad.diagnostics[0].at).toEqual({ element: 'ok' });
  });

  it('keeps (t ...) as a prop value when the vocabulary allows it', () => {
    const doc = parse('(ok: button (label (t ok.label)))', {
      vocabulary: i18nVocabulary(),
    });
    expect(doc.diagnostics).toEqual([]);
    expect(doc.roots[0].properties[0].values).toEqual([['t', 'ok.label']]);
    expect(format(doc)).toContain('(label (t ok.label))');
  });
});
