/**
 * createLocalizer: the locale from the ui-config layers, message text,
 * fallbacks, missing keys, interpolation, plurals and locale changes.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  createLocalizer,
  i18nVocabulary,
  message,
  resolveText,
} from '@link-foundation/ui-i18n';
import { catalogs, setup } from './helpers.js';

const close = { type: 'message', key: 'ui.dialog.close' };

describe('createLocalizer: locale from the config layers', () => {
  it('uses the user layer and falls back to en when it is cleared', () => {
    const { config, localizer } = setup();
    expect(localizer.locale()).toBe('en');
    config.set('user', 'app', 'locale', ['ru']);
    expect(localizer.locale()).toBe('ru');
    expect(localizer.text(close)).toBe('Закрыть');
    config.clear('user');
    expect(localizer.locale()).toBe('en');
    expect(localizer.text(close)).toBe('Close');
  });

  it('reads (locale ...) of the document as the site layer', () => {
    const document = parse('(app: document (locale zh))', {
      vocabulary: i18nVocabulary(),
    });
    const config = createConfig({ document });
    const localizer = createLocalizer({
      config,
      catalogs: catalogs(),
      languages: [],
    });
    expect(config.resolve('app', 'locale')).toEqual({
      layer: 'site',
      value: ['zh'],
    });
    expect(localizer.locale()).toBe('zh');
    config.set('user', 'app', 'locale', ['hi']);
    config.set('session', 'app', 'locale', ['ru']);
    expect(localizer.locale()).toBe('ru');
    config.clear('session');
    expect(localizer.text(close)).toBe('बंद करें');
  });

  it('matches a regional tag to an approved locale', () => {
    const { config, localizer } = setup();
    config.set('user', 'app', 'locale', ['ru-RU']);
    expect(localizer.locale()).toBe('ru');
  });

  it('falls back to determineLocale(languages, approved), then en', () => {
    expect(
      setup({ languages: ['de-DE', 'zh-CN', 'en'] }).localizer.locale()
    ).toBe('zh');
    expect(setup({ languages: ['de'] }).localizer.locale()).toBe('en');
    expect(
      setup({ languages: ['ru'], approved: ['en', 'hi'] }).localizer.locale()
    ).toBe('en');
  });

  it('switches the locale with setLocale through the user layer', () => {
    const { config, localizer } = setup();
    localizer.setLocale('hi');
    expect(config.resolve('app', 'locale')).toEqual({
      layer: 'user',
      value: ['hi'],
    });
    localizer.setLocale(null);
    expect(config.resolve('app', 'locale')).toBeUndefined();
  });

  it('works without a config', () => {
    const localizer = createLocalizer({
      catalogs: catalogs(),
      locale: 'ru',
      languages: [],
    });
    expect(localizer.text(close)).toBe('Закрыть');
    localizer.setLocale('zh');
    expect(localizer.text(close)).toBe('关闭');
    localizer.setLocale(null);
    expect(localizer.locale()).toBe('en');
  });

  it('requires catalogs', () => {
    expect(() => createLocalizer({})).toThrow();
  });
});

describe('createLocalizer: text', () => {
  it('returns literal text unchanged and reads raw (t ...) links', () => {
    const { config, localizer } = setup();
    expect(localizer.text('Plain')).toBe('Plain');
    config.set('user', 'app', 'locale', ['ru']);
    expect(localizer.text(['t', 'ok.label'])).toBe('Хорошо');
    expect(resolveText(message('ok.label'), localizer)).toBe('Хорошо');
  });

  it('returns the key of a missing message and calls onMissing', () => {
    const { config, localizer, missing } = setup();
    config.set('user', 'app', 'locale', ['ru']);
    expect(localizer.text(message('ui.nope'))).toBe('ui.nope');
    expect(missing).toEqual([['ui.nope', 'ru']]);
  });

  it('falls back to en for a key missing in the locale only', () => {
    const { config, localizer, missing } = setup();
    config.set('user', 'app', 'locale', ['zh']);
    expect(localizer.text(message('ok.label'))).toBe('OK');
    expect(missing).toEqual([]);
  });

  it('interpolates {name} and {{name}} params', () => {
    const { config, localizer } = setup();
    expect(localizer.text(message('greeting', { name: 'Ada' }))).toBe(
      'Hello, Ada!'
    );
    expect(localizer.text(message('welcome'), { name: 'Ada' })).toBe(
      'Welcome, Ada'
    );
    config.set('user', 'app', 'locale', ['ru']);
    expect(localizer.text(['t', 'greeting', ['name', 'Ada']])).toBe(
      'Привет, Ada!'
    );
  });

  it('chooses CLDR plural forms for ru (1, 3, 5) and en', () => {
    const { config, localizer } = setup();
    expect(localizer.text(message('files', { count: 1 }))).toBe('1 file');
    expect(localizer.text(message('files', { count: 5 }))).toBe('5 files');
    config.set('user', 'app', 'locale', ['ru']);
    expect(localizer.text(message('files', { count: 1 }))).toBe('1 файл');
    expect(localizer.text(message('files', { count: 3 }))).toBe('3 файла');
    expect(localizer.text(message('files', { count: 5 }))).toBe('5 файлов');
    expect(localizer.text(['t', 'files', ['count', '5']])).toBe('5 файлов');
  });

  it('resolves a message param that is itself a message', () => {
    const { localizer } = setup();
    expect(
      localizer.text(['t', 'greeting', ['name', ['t', 'ui.settings.title']]])
    ).toBe('Hello, Settings!');
  });
});

describe('createLocalizer: subscribe', () => {
  it('reports locale changes of the root once each', () => {
    const { config, localizer } = setup();
    const seen = [];
    const stop = localizer.subscribe((locale, previous) =>
      seen.push([locale, previous])
    );
    config.set('user', 'app', 'locale', ['ru']);
    config.set('user', 'ok', 'label', ['x']);
    config.set('session', 'app', 'locale', ['ru']);
    config.clear('user');
    config.clear('session');
    expect(seen).toEqual([
      ['ru', 'en'],
      ['en', 'ru'],
    ]);
    expect(stop()).toBe(true);
    config.set('user', 'app', 'locale', ['zh']);
    expect(seen.length).toBe(2);
  });

  it('reports setLocale without a config and isolates listener errors', () => {
    const errors = [];
    const localizer = createLocalizer({
      catalogs: catalogs(),
      languages: [],
      onListenerError: (error) => errors.push(error.message),
    });
    const seen = [];
    localizer.subscribe(() => {
      throw new Error('boom');
    });
    localizer.subscribe((locale) => seen.push(locale));
    localizer.setLocale('hi');
    expect(seen).toEqual(['hi']);
    expect(errors).toEqual(['boom']);
  });
});
