/**
 * The lucide, tabler and material-symbols adapters: names for every used
 * icon, records with source, SPDX licence, copyright and notice, and icons
 * from the installed (optional peer) packages.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { ICON_NAMES } from '../../src/icons/names.js';
import {
  FEATHER_DERIVED,
  LUCIDE,
  createLucideSource,
  lucideRecord,
} from '../../src/icons/adapters/lucide.js';
import { TABLER, createTablerSource } from '../../src/icons/adapters/tabler.js';
import {
  MATERIAL_SYMBOLS,
  MATERIAL_SYMBOLS_NOTICE,
  createMaterialSymbolsSource,
} from '../../src/icons/adapters/material-symbols.js';
import { isIconName } from '../../src/icons/adapters/shared.js';
import { ROOT, read } from './helpers.js';

const ADAPTERS = [
  [LUCIDE, createLucideSource, 'ISC', '0 0 24 24'],
  [TABLER, createTablerSource, 'MIT', '0 0 24 24'],
  [
    MATERIAL_SYMBOLS,
    createMaterialSymbolsSource,
    'Apache-2.0',
    '0 -960 960 960',
  ],
];

const pascal = (kebab) =>
  kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

describe('icon adapters', () => {
  for (const [adapter, create, license, viewBox] of ADAPTERS) {
    describe(adapter.set, () => {
      it('maps every used icon name to a library name', () => {
        expect(Object.keys(adapter.names).sort()).toEqual(
          [...ICON_NAMES].sort()
        );
        expect(Object.values(adapter.names).every(isIconName)).toBe(true);
      });

      it('records source, SPDX licence, copyright and notice', () => {
        for (const name of Object.values(adapter.names)) {
          const record = adapter.record(name);
          expect(record.id).toBe(`${adapter.set}-${name}`);
          expect(record.kind).toBe('icon');
          expect(record.license.startsWith(license)).toBe(true);
          expect(record.copyright.length > 0).toBe(true);
          expect(record.source.startsWith('https://')).toBe(true);
          expect(record.notice.startsWith('https://')).toBe(true);
          expect(record.attribution).toBe('required');
        }
      });

      it('resolves every used icon in currentColor', async () => {
        const source = create();
        for (const name of ICON_NAMES) {
          const icon = await source.resolve(name);
          expect([name, icon?.viewBox]).toEqual([name, viewBox]);
          expect([
            name,
            icon.body.includes('<path') || icon.body.includes('<'),
          ]).toEqual([name, true]);
          expect(icon.record.id).toBe(`${adapter.set}-${adapter.names[name]}`);
        }
        expect(source.records().length).toBe(ICON_NAMES.length);
      });

      it('rejects names that could leave the package', async () => {
        const source = create();
        expect(await source.resolve('../../package')).toBe(undefined);
        expect(await source.resolve('no-such-icon-anywhere')).toBe(undefined);
      });
    });
  }

  // Material names docks by the action ("dock to left" draws the panel on
  // the right); the logical names say where the panel is.
  it('draws the dock panel on the side the name says', async () => {
    /** x of the panel divider: a vertical line, or a Material panel edge. */
    const dividerX = (body) =>
      Number((/M(\d+) \d+(?:v|l0 )/.exec(body) ?? /H(\d+)v600/.exec(body))[1]);
    const middle = { '0 0 24 24': 12, '0 -960 960 960': 480 };
    for (const [adapter, create, , viewBox] of ADAPTERS) {
      const source = create();
      const left = dividerX((await source.resolve('dock-left')).body);
      const right = dividerX((await source.resolve('dock-right')).body);
      expect(`${adapter.set} left ${left < middle[viewBox]}`).toBe(
        `${adapter.set} left true`
      );
      expect(`${adapter.set} right ${right > middle[viewBox]}`).toBe(
        `${adapter.set} right true`
      );
    }
  });

  it('lets the loader be replaced', async () => {
    const source = createLucideSource({
      load: () =>
        Promise.resolve('<svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>'),
    });
    const icon = await source.resolve('close');
    expect(icon.viewBox).toBe('0 0 8 8');
    expect(icon.record.id).toBe('lucide-x');
  });

  it('marks exactly the Feather-derived Lucide icons ISC AND MIT', () => {
    const license = read(join(ROOT, 'node_modules/lucide/LICENSE'));
    const listed = license
      .split('derived from the Feather project:')[1]
      .split('The MIT License')[0]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    expect(listed.length > 100).toBe(true);
    // Lucide renamed some Feather icons; the old names stay as aliases.
    const index = read(join(ROOT, 'node_modules/lucide/dist/esm/lucide.mjs'));
    const canonical = new Map();
    for (const [, aliases, file] of index.matchAll(
      /export \{ ([^}]+) \} from '\.\/icons\/([a-z0-9-]+)\.mjs'/g
    )) {
      for (const alias of aliases.matchAll(/default as (\w+)/g)) {
        canonical.set(alias[1], file);
      }
    }
    const derived = new Set(listed.map((name) => canonical.get(pascal(name))));
    for (const name of Object.values(LUCIDE.names)) {
      expect([name, FEATHER_DERIVED.has(name)]).toEqual([
        name,
        derived.has(name),
      ]);
      expect(lucideRecord(name).license).toBe(
        derived.has(name) ? 'ISC AND MIT' : 'ISC'
      );
    }
  });

  it('ships a NOTICE with Material Symbols', () => {
    expect(MATERIAL_SYMBOLS.notices.NOTICE).toBe(MATERIAL_SYMBOLS_NOTICE);
    expect(
      MATERIAL_SYMBOLS_NOTICE.includes('Apache License, Version 2.0')
    ).toBe(true);
    expect(MATERIAL_SYMBOLS.licenseFiles).toEqual(['LICENSE']);
  });
});
