/**
 * The own icon set and its records: every file has a CC0-1.0 record, every
 * used name has a file, the generated module is current, and no package
 * depends on an icon set of the avoid list.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { matchesFile } from '../../../../scripts/lib/asset-records.mjs';
import {
  avoidedDependencies,
  buildIcons,
} from '../../../../scripts/build-icons.mjs';
import { ICON_NAMES, MIRROR_IN_RTL } from '../../src/icons/names.js';
import OWN_ICONS from '../../src/icons/own-icons.js';
import { ROOT, assetRecords, read } from './helpers.js';

const OWN_DIR = 'assets/icons/own';
const ownFiles = () =>
  readdirSync(join(ROOT, OWN_DIR))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => `${OWN_DIR}/${file}`)
    .sort();

describe('own icon records', () => {
  it('has about 32 own icons', () => {
    expect(ICON_NAMES.length).toBe(32);
    expect(ownFiles().length).toBe(ICON_NAMES.length);
  });

  it('gives every own file one CC0-1.0 icon record without copyright', () => {
    const records = assetRecords();
    for (const file of ownFiles()) {
      const matching = records.filter((record) =>
        record.files.some((pattern) => matchesFile(file, pattern))
      );
      expect([file, matching.length]).toEqual([file, 1]);
      const [record] = matching;
      expect([file, record.kind, record.license, record.copyright]).toEqual([
        file,
        'icon',
        'CC0-1.0',
        'none',
      ]);
      expect(record.parseErrors).toEqual([]);
    }
  });

  it('has an own file for every used icon name', () => {
    for (const name of ICON_NAMES) {
      expect([name, existsSync(join(ROOT, OWN_DIR, `${name}.svg`))]).toEqual([
        name,
        true,
      ]);
    }
  });

  it('draws own icons on a 24x24 grid with a 2px currentColor stroke', () => {
    for (const file of ownFiles()) {
      const svg = read(join(ROOT, file));
      expect([file, svg.includes('viewBox="0 0 24 24"')]).toEqual([file, true]);
      expect([file, svg.includes('stroke-width="2"')]).toEqual([file, true]);
      expect([file, svg.includes('stroke="currentColor"')]).toEqual([
        file,
        true,
      ]);
      expect([file, /#[0-9a-f]{3,8}\b|rgb\(/i.test(svg)]).toEqual([
        file,
        false,
      ]);
    }
  });

  it('keeps the generated own-icons.js in step with the files', async () => {
    const { errors, stale } = await buildIcons({
      root: ROOT,
      sets: ['own'],
      check: true,
    });
    expect(errors).toEqual([]);
    expect(stale).toEqual([]);
    expect(Object.keys(OWN_ICONS.icons).sort()).toEqual([...ICON_NAMES].sort());
    for (const [name, icon] of Object.entries(OWN_ICONS.icons)) {
      expect(icon.viewBox).toBe('0 0 24 24');
      expect(icon.mirrorInRtl).toBe(MIRROR_IN_RTL.has(name));
      expect(icon.body.includes('currentColor')).toBe(true);
    }
    expect(OWN_ICONS.records.every((r) => r.license === 'CC0-1.0')).toBe(true);
  });
});

describe('avoid list', () => {
  it('finds no Remix Icon or SF Symbols dependency in any package.json', () => {
    expect(avoidedDependencies(ROOT)).toEqual([]);
  });
});
