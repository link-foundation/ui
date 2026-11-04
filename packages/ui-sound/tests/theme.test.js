import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'test-anywhere';
import { readSoundTheme } from '../src/index.js';

export const themeText = (name) =>
  readFileSync(new URL(`../themes/${name}.lino`, import.meta.url), 'utf8');

describe('sound themes', () => {
  it('reads both themes without diagnostics and preserves all provenance', () => {
    for (const name of ['quiet', 'immortality']) {
      const { theme, diagnostics } = readSoundTheme(themeText(name));
      expect(diagnostics).toEqual([]);
      expect(theme.name).toBe(name);
      expect(Object.keys(theme.voices).length).toBe(name === 'quiet' ? 5 : 26);
      for (const voice of Object.values(theme.voices)) {
        expect(typeof voice.source.label).toBe('string');
        expect(typeof voice.source.license).toBe('string');
        if (name === 'immortality') {
          expect(typeof voice.source.character).toBe('string');
          expect(voice.source.url.startsWith('https://')).toBe(true);
        }
      }
    }
  });
  it('reports unknown keys, malformed input and unsafe numbers without throwing', () => {
    for (const text of [
      'sound-theme bad\n  voice tick\n    unknown 1',
      '(',
      'sound-theme bad\n  voice tick\n    gain NaN',
      'sound-theme bad\n  event click\n    voices missing',
      'sound-theme bad\n  voice tick\n    repeat 999999',
    ]) {
      expect(readSoundTheme(text).diagnostics.length > 0).toBe(true);
    }
  });
});

describe('theme diagnostics', () => {
  it('specifically identifies an unknown key on an otherwise valid voice', () => {
    const text = themeText('quiet').replace(
      'voice tick\n',
      'voice tick\n    mystery 1\n'
    );
    const result = readSoundTheme(text);
    expect(result.theme).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toEqual(['unknown-key']);
  });
});
