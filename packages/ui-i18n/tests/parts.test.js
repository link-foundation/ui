import { describe, it, expect } from 'test-anywhere';
import {
  createLocalizer,
  message,
  messageParts,
  iconPart,
} from '../src/index.js';

describe('inline icon message parts', () => {
  const localizer = createLocalizer({
    catalogs: {
      en: { sentence: 'I {love} links {unknown}', love: 'love' },
      ru: { sentence: 'Я {love} links {unknown}', love: 'люблю' },
    },
    locale: 'en',
  });
  const value = message('sentence');
  it('returns text, a localized icon and text in each locale', () => {
    for (const [locale, start, label] of [
      ['en', 'I ', 'love'],
      ['ru', 'Я ', 'люблю'],
    ]) {
      localizer.setLocale(locale);
      expect(
        messageParts(value, localizer, {
          love: iconPart('lucide:heart', message('love')),
        })
      ).toEqual([
        start,
        { type: 'icon', set: 'lucide', name: 'heart', label, role: 'img' },
        ' links {unknown}',
      ]);
    }
  });
  it('keeps unknown tokens literal and returns HTML as text', () => {
    expect(
      messageParts('<b>{love}</b>', localizer, {
        love: iconPart('lucide:heart', 'Love'),
      })
    ).toEqual([
      '<b>',
      {
        type: 'icon',
        set: 'lucide',
        name: 'heart',
        label: 'Love',
        role: 'img',
      },
      '</b>',
    ]);
    expect(messageParts('{missing}', localizer, {})).toEqual(['{missing}']);
  });
});
