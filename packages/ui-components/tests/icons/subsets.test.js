import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { buildIcons, parseArgs } from '../../../../scripts/build-icons.mjs';
import { parseAssetRecords } from '../../../../scripts/lib/asset-records.mjs';
import { createStaticSource } from '../../src/icons/icon-registry.js';
import { inFixture, read } from './helpers.js';

const names = [
  'star',
  'heart',
  'flame',
  'dot',
  'sun',
  'moon',
  'cloud',
  'rainbow',
  'rocket',
  'house',
  'bell',
  'book',
  'camera',
  'circle',
  'code',
  'coffee',
  'earth',
  'eye',
  'flag',
  'gift',
];
const manifest = `icons\n${names.map((name) => `  'lucide:${name}'`).join('\n')}\n`;

describe('app-chosen static subsets', () => {
  it('ships exactly 20 icons, records, sprite symbols and license with no runtime resolver', async () => {
    await inFixture({ extra: { 'names.lino': manifest } }, async (root) => {
      const result = await buildIcons({
        root,
        out: 'out',
        names: 'names.lino',
      });
      expect(result.errors).toEqual([]);
      expect(Object.keys(result.built)).toEqual(['lucide']);
      expect(Object.keys(result.built.lucide.icons).sort()).toEqual(
        [...names].sort()
      );
      expect(result.built.lucide.records.length).toBe(20);
      expect(read(join(root, 'out/lucide.svg')).match(/<symbol /g).length).toBe(
        20
      );
      expect(
        parseAssetRecords(read(join(root, 'out/NOTICE.lino'))).length
      ).toBe(20);
      expect(result.written.includes('out/licenses/lucide/LICENSE')).toBe(true);
      expect(read(join(root, 'out/ATTRIBUTION.md'))).toContain('Lucide');
      const source = createStaticSource(result.built.lucide);
      expect((await source.resolve('flame')).body.length > 0).toBe(true);
      expect(await source.resolve('close')).toBe(undefined);
    });
  });

  it('lists every unknown name and writes nothing', async () => {
    await inFixture(
      {
        extra: {
          'names.lino':
            "icons\n  'lucide:no-such-a'\n  'brand:linkedin'\n  'lucide:no-such-b'\n",
        },
      },
      async (root) => {
        const result = await buildIcons({
          root,
          out: 'out',
          names: 'names.lino',
        });
        for (const name of ['no-such-a', 'linkedin', 'no-such-b']) {
          expect(result.errors.join('\n')).toContain(name);
        }
        expect(result.written).toEqual([]);
      }
    );
  });

  it('preserves brand titles and trademark notices in static output', async () => {
    await inFixture(
      { extra: { 'names.lino': "icons\n  'brand:github'\n" } },
      async (root) => {
        const result = await buildIcons({
          root,
          out: 'out',
          names: 'names.lino',
        });
        expect(result.errors).toEqual([]);
        expect(
          (await createStaticSource(result.built.brand).resolve('github')).title
        ).toBe('GitHub');
        expect(read(join(root, 'out/ATTRIBUTION.md'))).toContain('trademark');
        expect(result.written.includes('out/licenses/brand/LICENSE.md')).toBe(
          true
        );
        expect(
          result.written.includes('out/licenses/brand/DISCLAIMER.md')
        ).toBe(true);
      }
    );
  });

  it('parses --names', () =>
    expect(parseArgs(['--names', 'icons.lino']).names).toBe('icons.lino'));
});
