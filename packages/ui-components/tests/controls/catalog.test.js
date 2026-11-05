/**
 * Every control kind of `kinds.lino` is complete: a catalog entry, a story
 * file, a test file and (for a stateful kind) a machine. A new kind that
 * misses one of them fails here.
 */

import { describe, it, expect } from 'test-anywhere';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import {
  CONTROL_MACHINES,
  controlKindMeta,
  controlKindNames,
  parseCatalog,
  parseStories,
  storiesDocument,
  storyId,
} from '../../src/controls/index.js';
import { REFERENCE_MACHINES } from '../../src/behavior/machines/index.js';
import { mountDoc } from '../support/controls.js';

const pkg = (file) => fileURLToPath(new URL(`../../${file}`, import.meta.url));
const read = (file) => readFileSync(pkg(file), 'utf8');

const KINDS = controlKindNames();
const catalog = parseCatalog(read('src/controls/catalog.lino'));
const storySets = KINDS.map((kind) =>
  parseStories(read(`stories/${kind}.lino`))
);

describe('control catalog', () => {
  it('has the 19 basic controls of #34, chip and accordion', () => {
    expect(KINDS.length).toBe(21);
  });

  it('has an entry per kind, in kinds.lino order, and nothing else', () => {
    expect([...catalog.keys()]).toEqual(KINDS);
    for (const [kind, entry] of catalog) {
      expect(typeof entry.title).toBe('string');
      expect(entry.stories).toBe(`${kind}-stories`);
      expect(typeof entry.apg).toBe('string');
    }
  });

  it('has a story file per kind with at least one story', () => {
    KINDS.forEach((kind, i) => {
      const set = storySets[i];
      expect([set.id, set.component]).toEqual([`${kind}-stories`, kind]);
      expect(set.stories.length > 0).toBe(true);
    });
  });

  it('has a test file per kind', () => {
    const missing = KINDS.filter(
      (kind) => !existsSync(pkg(`tests/controls/${kind}.test.js`))
    );
    expect(missing).toEqual([]);
  });

  it('has its own machine file or a shared machine, and nothing stale', () => {
    const own = KINDS.filter(
      (kind) => controlKindMeta(kind).machine === `${kind}-machine`
    );
    expect(Object.keys(CONTROL_MACHINES).sort()).toEqual([...own].sort());
    for (const kind of KINDS) {
      const { machine } = controlKindMeta(kind);
      expect(existsSync(pkg(`src/controls/machines/${kind}.lino`))).toBe(
        own.includes(kind)
      );
      if (own.includes(kind)) {
        expect(CONTROL_MACHINES[kind]).toMatch(
          new RegExp(`^${machine}: machine$`, 'mu')
        );
      } else if (machine !== null) {
        expect(Object.keys(REFERENCE_MACHINES)).toContain(machine);
      }
    }
  });

  it('renders every story without a diagnostic', () => {
    const text = storiesDocument(storySets).replace(
      /^\(stories: document\n/,
      ''
    );
    const t = mountDoc(text.slice(0, -1));
    expect(t.codes()).toEqual([]);
    for (const set of storySets) {
      for (const story of set.stories) {
        const node = t.node(storyId(set.component, story.name));
        expect(node?.localName).toBe(`ui-${story.element[0]}`);
      }
    }
  });
});
