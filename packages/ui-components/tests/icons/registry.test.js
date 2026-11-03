/**
 * The icon registry: references, fallback to the own set and then to the
 * placeholder, registering and unregistering sets, and static sources.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  PLACEHOLDER_ICON,
  createStaticSource,
  getIconSet,
  iconRecords,
  iconSets,
  onIconSetsChange,
  parseIconRef,
  registerIconSet,
  resolveIcon,
} from '../../src/icons/icon-registry.js';
import { DEFAULT_ICON_SET, ICON_NAMES } from '../../src/icons/names.js';

const FIXTURE = {
  set: 'fixture',
  icons: {
    close: {
      viewBox: '0 0 10 10',
      body: '<path d="M1 1 9 9"/>',
      record: 'f-x',
    },
    send: { viewBox: '0 0 10 10', body: '<path d="M1 5h8"/>', record: 'f-x' },
  },
  records: [
    { id: 'f-x', kind: 'icon', files: [], license: 'MIT', copyright: 'Me' },
  ],
};

/** Run `body` with `source` registered as `set`, unregistering after. */
async function withSet(set, source, body) {
  const unregister = registerIconSet(set, source);
  try {
    await body();
  } finally {
    unregister();
  }
}

describe('parseIconRef', () => {
  it('reads names, set:name strings and objects', () => {
    expect(parseIconRef('close')).toEqual({ set: 'own', name: 'close' });
    expect(parseIconRef('lucide:check')).toEqual({
      set: 'lucide',
      name: 'check',
    });
    expect(parseIconRef({ set: 'tabler', name: 'x' })).toEqual({
      set: 'tabler',
      name: 'x',
    });
    expect(parseIconRef({ name: 'x' })).toEqual({ set: 'own', name: 'x' });
    expect(parseIconRef(undefined)).toEqual({ set: 'own', name: '' });
  });
});

describe('resolveIcon', () => {
  it('registers the own set at load, with every used name', async () => {
    expect(DEFAULT_ICON_SET).toBe('own');
    expect(iconSets().includes('own')).toBe(true);
    for (const name of ICON_NAMES) {
      const icon = await resolveIcon(name);
      expect([name, icon.set, icon.placeholder]).toEqual([
        name,
        'own',
        undefined,
      ]);
      expect(icon.record.license).toBe('CC0-1.0');
      expect(icon.record.id).toBe(`icon-${name}`);
    }
  });

  it('returns IconData {viewBox, body, mirrorInRtl, record}', async () => {
    const icon = await resolveIcon('send');
    expect(icon.viewBox).toBe('0 0 24 24');
    expect(typeof icon.body).toBe('string');
    expect(icon.mirrorInRtl).toBe(true);
    expect((await resolveIcon('close')).mirrorInRtl).toBe(false);
  });

  it('falls back to the own set for an unknown set or a missing name', async () => {
    const unknownSet = await resolveIcon('nowhere:close');
    expect([unknownSet.set, unknownSet.name]).toEqual(['own', 'close']);
    await withSet('fixture', createStaticSource(FIXTURE), async () => {
      expect((await resolveIcon('fixture:close')).set).toBe('fixture');
      expect((await resolveIcon('fixture:menu')).set).toBe('own');
    });
  });

  it('falls back to the placeholder for an unknown name', async () => {
    const icon = await resolveIcon('lucide:no-such-icon');
    expect(icon.placeholder).toBe(true);
    expect(icon.body).toBe(PLACEHOLDER_ICON.body);
    expect(icon.name).toBe('no-such-icon');
    expect((await resolveIcon('')).placeholder).toBe(true);
  });

  it('treats a failing source as missing', async () => {
    const failing = {
      resolve: () => Promise.reject(new Error('offline')),
      records: () => [],
    };
    await withSet('failing', failing, async () => {
      expect((await resolveIcon('failing:close')).set).toBe('own');
    });
  });
});

describe('registerIconSet', () => {
  it('rejects bad sets and sources', () => {
    expect(() => registerIconSet('', createStaticSource(FIXTURE))).toThrow();
    expect(() => registerIconSet('x', {})).toThrow();
  });

  it('notifies listeners, replaces and unregisters', async () => {
    const seen = [];
    const stop = onIconSetsChange((set) => seen.push(set));
    const source = createStaticSource(FIXTURE);
    await withSet('fixture', source, () => {
      expect(getIconSet('fixture')).toBe(source);
      expect(iconSets().includes('fixture')).toBe(true);
    });
    stop();
    expect(seen).toEqual(['fixture', 'fixture']);
    expect(getIconSet('fixture')).toBe(undefined);
  });

  it('restores the own source when a replacement of own goes', async () => {
    const own = getIconSet('own');
    await withSet('own', createStaticSource(FIXTURE), async () => {
      expect((await resolveIcon('close')).viewBox).toBe('0 0 10 10');
    });
    expect(getIconSet('own')).toBe(own);
    expect((await resolveIcon('close')).viewBox).toBe('0 0 24 24');
  });

  it('ignores a stale unregister', () => {
    const first = registerIconSet('fixture', createStaticSource(FIXTURE));
    const second = createStaticSource(FIXTURE);
    const unregister = registerIconSet('fixture', second);
    first();
    expect(getIconSet('fixture')).toBe(second);
    unregister();
  });
});

describe('createStaticSource and iconRecords', () => {
  it('serves module icons and records', async () => {
    const source = createStaticSource(FIXTURE);
    expect(source.names()).toEqual(['close', 'send']);
    const send = await source.resolve('send');
    expect(send.mirrorInRtl).toBe(true);
    expect(send.record.license).toBe('MIT');
    expect(await source.resolve('toString')).toBe(undefined);
  });

  it('lists the records of the registered sets', async () => {
    expect(iconRecords(['own']).length).toBe(ICON_NAMES.length);
    await withSet('fixture', createStaticSource(FIXTURE), () => {
      expect(iconRecords(['fixture'])).toEqual(FIXTURE.records);
      expect(iconRecords().length).toBe(ICON_NAMES.length + 1);
    });
  });
});
