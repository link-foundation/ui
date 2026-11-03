import { describe, it, expect } from 'test-anywhere';

import {
  defaults,
  fromLegacyJson,
  fromLino,
  fromShareHash,
  MAX_SHARE_HASH,
  toLino,
  toShareHash,
} from '../src/index.js';
import { codes, demoSchema, fixture, immortalitySchema } from './helpers.js';

const schema = demoSchema();
const imm = immortalitySchema();

describe('values documents', () => {
  it('round-trips values', () => {
    const values = {
      ...defaults(schema),
      'liquid.blur': 24,
      'theme.mode': 'dark',
      accent: '#00AAFF',
    };
    const text = toLino(schema, values);
    expect(text).toBe(
      "settings\n  version 2\n  liquid.blur 24\n  theme.mode dark\n  accent '#00AAFF'"
    );
    expect(toLino(schema, values, { style: 'inline' })).toBe(
      "(settings (version 2) (liquid.blur 24) (theme.mode dark) (accent '#00AAFF'))"
    );
    const read = fromLino(schema, text);
    expect(read.ok).toBe(true);
    expect(read.values).toEqual(values);
  });

  it('writes an empty document for the defaults', () => {
    expect(toLino(schema, defaults(schema))).toBe('settings\n  version 2');
  });

  it('migrates documents of an older version', () => {
    const read = fromLino(schema, '(settings (version 1) (blur 30))');
    expect(read.values['liquid.blur']).toBe(30);
  });

  it('reads the multi-line form and rejects unknown keys', () => {
    const read = fromLino(
      schema,
      '(settings\n  (version 2)\n  (liquid.blur 24)\n  (evil x))'
    );
    expect(read.values['liquid.blur']).toBe(24);
    expect(read.rejected).toEqual(['evil']);
  });

  it('never throws on broken documents', () => {
    expect(codes(fromLino(schema, '(other 1)').diagnostics)).toEqual([
      'no-settings',
    ]);
    const broken = fromLino(schema, '(settings (version 2');
    expect(broken.ok).toBe(false);
    expect(broken.values).toEqual(defaults(schema));
    expect(fromLino(schema, undefined).ok).toBe(false);
  });
});

describe('legacy JSON', () => {
  it('reads immortality v2 JSON', () => {
    const read = fromLegacyJson(imm, fixture('immortality-v2.json'));
    expect(read.ok).toBe(true);
    expect(read.values.palette).toBe('mission');
    expect(read.values.cornerSize).toBe(20);
    expect(read.values.volume).toBe(40);
  });

  it('reads unversioned objects as version 1 and rejects non-objects', () => {
    expect(fromLegacyJson(imm, { palette: 'mission' }).values.palette).toBe(
      'poseidon'
    );
    expect(fromLegacyJson(imm, '[1]').ok).toBe(false);
    expect(fromLegacyJson(imm, '{bad').ok).toBe(false);
  });
});

describe('share links', () => {
  it('round-trips through the hash', () => {
    const values = { ...defaults(schema), 'liquid.blur': 24 };
    const hash = toShareHash(schema, values);
    expect(hash).toBe(
      `#settings=${encodeURIComponent('(settings (version 2) (liquid.blur 24))')}`
    );
    const read = fromShareHash(schema, hash);
    expect(read.ok).toBe(true);
    expect(read.format).toBe('lino');
    expect(read.values).toEqual(values);
  });

  it('reads immortality #ui= links', () => {
    const json = fixture('immortality-v2.json');
    const read = fromShareHash(imm, `#ui=${encodeURIComponent(json)}`);
    expect(read.ok).toBe(true);
    expect(read.format).toBe('immortality-json');
    expect(read.values.palette).toBe('mission');
    expect(read.values.cornerSize).toBe(20);
  });

  it('reads unversioned immortality links against the v1 look', () => {
    const hash = `#ui=${encodeURIComponent('{"cornerSize":20}')}`;
    const read = fromShareHash(imm, hash);
    expect(read.values.palette).toBe('mission');
    expect(read.values.glow).toBe('light');
    expect(read.values.statusBar).toBe(false);
  });

  it('reads konard.github.io #settings= JSON links', () => {
    const json = JSON.stringify({ 'liquid.blur': 30, 'theme.mode': 'dark' });
    const read = fromShareHash(schema, `#settings=${encodeURIComponent(json)}`);
    expect(read.format).toBe('konard-json');
    expect(read.values['liquid.blur']).toBe(30);
    expect(read.values['theme.mode']).toBe('dark');
  });

  it('keeps the comfort settings of the viewer', () => {
    const json = fixture('immortality-v2.json');
    const viewer = { animations: true, volume: 80, palette: 'poseidon' };
    const read = fromShareHash(imm, `#ui=${encodeURIComponent(json)}`, viewer);
    expect(read.values.animations).toBe(true);
    expect(read.values.volume).toBe(80);
    expect(read.values.palette).toBe('mission');

    const lino = toShareHash(schema, {
      'motion.reduce': false,
      accent: '#000000',
    });
    const mine = fromShareHash(schema, lino, { 'motion.reduce': true });
    expect(mine.values['motion.reduce']).toBe(true);
    expect(mine.values.accent).toBe('#000000');
  });

  it('rejects hashes over 8 KiB', () => {
    const padding = 'x'.repeat(9 * 1024);
    const hash = `#settings=${encodeURIComponent(`(settings (version 2) (pad ${padding}))`)}`;
    expect(hash.length).toBeGreaterThan(MAX_SHARE_HASH);
    const viewer = { 'liquid.blur': 5 };
    const read = fromShareHash(schema, hash, viewer);
    expect(read.ok).toBe(false);
    expect(codes(read.diagnostics)).toEqual(['hash-too-large']);
    expect(read.values['liquid.blur']).toBe(5);
  });

  it('never throws on other hashes', () => {
    expect(codes(fromShareHash(schema, '#about').diagnostics)).toEqual([
      'no-settings',
    ]);
    expect(
      codes(fromShareHash(schema, '#settings=%E0%A4%A').diagnostics)
    ).toEqual(['bad-encoding']);
    expect(fromShareHash(schema, '#settings=%7Bbad').ok).toBe(false);
    expect(fromShareHash(schema, null).ok).toBe(false);
    expect(fromShareHash(schema, 'a=1&settings=(settings)').ok).toBe(true);
  });
});
