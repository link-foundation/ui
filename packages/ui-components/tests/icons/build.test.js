/**
 * scripts/build-icons.mjs on fixture repositories: it fails with a clear
 * message for an icon without a record, for an icon set of the avoid list
 * and for a licence off the allow list, and it writes currentColor
 * modules, sprites and NOTICE.lino otherwise.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { parseAssetRecords } from '../../../../scripts/lib/asset-records.mjs';
import {
  AVOID_LIST,
  avoidListProblems,
  buildIcons,
  optimizeSvg,
  parseArgs,
} from '../../../../scripts/build-icons.mjs';
import { ROOT, SVG, inFixture, read } from './helpers.js';

const record = (id, files, license, copyright = 'none') =>
  `(${id}: asset
  (kind icon)
  (files ${files})
  (license ${license})
  (copyright '${copyright}')
  (attribution none))
`;

const hasError = (errors, ...parts) =>
  errors.some((error) => parts.every((part) => error.includes(part)));

describe('build-icons failures', () => {
  it('builds the plain fixture', async () => {
    await inFixture({}, async (root) => {
      const { errors, written } = await buildIcons({ root, sets: ['own'] });
      expect(errors).toEqual([]);
      expect(written.includes('packages/ui-components/dist/icons/own.js')).toBe(
        true
      );
    });
  });

  it('fails, naming the file, for an icon without a record', async () => {
    const extra = { 'assets/icons/own/fixture-unrecorded.svg': SVG };
    await inFixture({ extra }, async (root) => {
      const { errors, written } = await buildIcons({ root, sets: ['own'] });
      expect(
        hasError(errors, 'assets/icons/own/fixture-unrecorded.svg', 'no record')
      ).toBe(true);
      expect(written).toEqual([]);
      expect(existsSync(join(root, 'packages'))).toBe(false);
    });
  });

  it('fails for a used icon name without a file', async () => {
    await inFixture({}, async (root) => {
      const { rmSync } = await import('node:fs');
      rmSync(join(root, 'assets/icons/own/close.svg'));
      const { errors } = await buildIcons({ root, sets: ['own'] });
      expect(
        hasError(errors, 'icon "close" is used', 'assets/icons/own/close.svg')
      ).toBe(true);
    });
  });

  it('fails for a record with (license LicenseRef-RemixIcon)', async () => {
    const extra = { 'assets/icons/remix/fixture-remix.svg': SVG };
    const records = record(
      'fixture-remix',
      'assets/icons/remix/fixture-remix.svg',
      'LicenseRef-RemixIcon',
      'Remix Design'
    );
    await inFixture({ extra, records }, async (root) => {
      const { errors, written } = await buildIcons({
        root,
        sets: ['own', 'remix'],
      });
      expect(
        hasError(errors, 'record "fixture-remix"', 'Remix Icon is on the avoid')
      ).toBe(true);
      expect(written).toEqual([]);
    });
  });

  it('fails for an SF Symbols source', async () => {
    const extra = { 'assets/icons/apple/fixture-sf.svg': SVG };
    const records = `${record(
      'fixture-sf',
      'assets/icons/apple/fixture-sf.svg',
      'MIT',
      'Someone'
    ).replace(
      '(attribution none)',
      "(source 'https://developer.apple.com/sf-symbols/')\n  (attribution none)"
    )}`;
    await inFixture({ extra, records }, async (root) => {
      const { errors } = await buildIcons({ root, sets: ['apple'] });
      expect(hasError(errors, 'record "fixture-sf"', 'SF Symbols')).toBe(true);
    });
  });

  it('fails for a licence off the allow list', async () => {
    const extra = { 'assets/icons/gpl/fixture-gpl.svg': SVG };
    const records = record(
      'fixture-gpl',
      'assets/icons/gpl/fixture-gpl.svg',
      'GPL-3.0-only',
      'Someone'
    );
    await inFixture({ extra, records }, async (root) => {
      const { errors } = await buildIcons({ root, sets: ['gpl'] });
      expect(hasError(errors, 'fixture-gpl', 'GPL-3.0-only')).toBe(true);
    });
  });

  it('fails for an own record that is not CC0-1.0', async () => {
    await inFixture({}, async (root) => {
      const { writeFileSync } = await import('node:fs');
      const lino = join(root, 'assets/assets.lino');
      writeFileSync(
        lino,
        read(lino).replace(
          /\(icon-close: asset([^]*?)\(license CC0-1\.0\)/,
          '(icon-close: asset$1(license MIT)'
        )
      );
      const { errors } = await buildIcons({ root, sets: ['own'] });
      expect(hasError(errors, 'record "icon-close"', 'CC0-1.0')).toBe(true);
    });
  });

  it('fails for an avoided dependency in a package.json', async () => {
    const extra = {
      'package.json': JSON.stringify({ dependencies: { remixicon: '^4.0.0' } }),
    };
    await inFixture({ extra }, async (root) => {
      const { errors } = await buildIcons({ root, sets: ['own'] });
      expect(hasError(errors, 'package.json', 'remixicon')).toBe(true);
    });
  });

  it('fails for an unknown set', async () => {
    await inFixture({}, async (root) => {
      const { errors } = await buildIcons({ root, sets: ['nope'] });
      expect(hasError(errors, 'unknown icon set "nope"')).toBe(true);
    });
  });

  it('lists Remix Icon and SF Symbols on the avoid list', () => {
    expect(AVOID_LIST.map((entry) => entry.name)).toEqual([
      'Remix Icon',
      'SF Symbols',
    ]);
    expect(
      avoidListProblems({ id: 'x', license: 'Apache-2.0', source: 'remixicon' })
        .length
    ).toBe(1);
    expect(avoidListProblems({ id: 'x', license: 'ISC' })).toEqual([]);
  });
});

describe('build-icons output', () => {
  it('turns fixed colours into currentColor and drops invisible paths', () => {
    const svg = optimizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path fill="#ff0000" d="M4 4h16v16H4z"/><circle stroke="rgb(1,2,3)" style="fill: blue" cx="12" cy="12" r="4"/></svg>'
    );
    expect(svg.includes('#ff0000')).toBe(false);
    expect(svg.includes('rgb(')).toBe(false);
    expect(svg.includes('blue')).toBe(false);
    expect(svg.includes('M0 0h24v24H0z')).toBe(false);
    expect(svg.includes('currentColor')).toBe(true);
    expect(svg.includes('width=')).toBe(false);
  });

  it('writes a module and a sprite per set, NOTICE.lino and ATTRIBUTION.md', async () => {
    await inFixture({}, async (root) => {
      const { errors, written } = await buildIcons({
        root,
        out: 'out',
        sets: ['own', 'lucide'],
      });
      expect(errors).toEqual([]);
      for (const file of [
        'out/own.js',
        'out/own.svg',
        'out/lucide.js',
        'out/lucide.svg',
        'out/licenses/lucide/LICENSE',
        'out/NOTICE.lino',
        'out/ATTRIBUTION.md',
      ]) {
        expect([file, written.includes(file)]).toEqual([file, true]);
      }
      const sprite = read(join(root, 'out/lucide.svg'));
      expect(sprite.includes('<symbol id="lucide-close"')).toBe(true);
      const module = await import(
        `${new globalThis.URL(`file://${join(root, 'out/lucide.js')}`).href}`
      );
      expect(Object.keys(module.default.icons).length).toBe(32);
      expect(module.default.icons.close.body.includes('currentColor')).toBe(
        true
      );

      const notice = parseAssetRecords(read(join(root, 'out/NOTICE.lino')));
      expect(notice.every((r) => r.parseErrors.length === 0)).toBe(true);
      const lucide = notice.filter((r) => r.id.startsWith('lucide-'));
      expect(lucide.length).toBe(32);
      expect(lucide.every((r) => /^ISC( AND MIT)?$/.test(r.license))).toBe(
        true
      );
      expect(lucide.some((r) => r.license === 'ISC')).toBe(true);
      expect(lucide.every((r) => r.copyright.includes('Lucide'))).toBe(true);
      expect(lucide.every((r) => r.source.includes('lucide'))).toBe(true);
      expect(notice.filter((r) => r.id.startsWith('icon-')).length).toBe(32);
      const attribution = read(join(root, 'out/ATTRIBUTION.md'));
      expect(attribution.includes('## ISC')).toBe(true);
      expect(attribution.includes('lucide-')).toBe(true);
    });
  });

  it('ships the Material Symbols LICENSE and NOTICE', async () => {
    await inFixture({}, async (root) => {
      const { errors, written } = await buildIcons({
        root,
        out: 'out',
        sets: ['material-symbols'],
      });
      expect(errors).toEqual([]);
      expect(written.includes('out/licenses/material-symbols/LICENSE')).toBe(
        true
      );
      expect(written.includes('out/licenses/material-symbols/NOTICE')).toBe(
        true
      );
      const notice = parseAssetRecords(read(join(root, 'out/NOTICE.lino')));
      expect(notice.every((r) => r.license === 'Apache-2.0')).toBe(true);
    });
  });

  it('parses its command line', () => {
    const options = parseArgs([
      '--root',
      '/r',
      '--sets',
      'own, lucide',
      '--check',
    ]);
    expect(options.sets).toEqual(['own', 'lucide']);
    expect(options.check).toBe(true);
  });

  it('exits 1 with ::error:: lines from the command line', async () => {
    const extra = { 'assets/icons/own/fixture-unrecorded.svg': SVG };
    await inFixture({ extra }, (root) => {
      const result = spawnSync(
        'node',
        [
          join(ROOT, 'scripts/build-icons.mjs'),
          '--root',
          root,
          '--sets',
          'own',
        ],
        { encoding: 'utf8' }
      );
      if (result.error !== undefined) {
        return; // no node on PATH (this runtime runs the API tests above)
      }
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        '::error::own: assets/icons/own/fixture-unrecorded.svg'
      );
    });
  });
});
