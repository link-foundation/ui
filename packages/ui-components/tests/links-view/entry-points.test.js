/**
 * Behaviour: the package root re-exports every entry point (`behavior`,
 * `a11y`, `charts`, `diagrams`, `layout`, `links-view` and `icons`), so no
 * two of them may export the same name, either as a value or in their
 * `.d.ts` declarations. TypeScript reports a name declared by two `export *` sources
 * as ambiguous (TS2308), which is how `Point` of `diagrams` and `links-view`
 * once clashed.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const ENTRY_POINTS = [
  'behavior',
  'a11y',
  'charts',
  'diagrams',
  'layout',
  'links-view',
  'icons',
  'overlays',
];
const SRC = new URL('../../src/', import.meta.url);

/**
 * The names a declaration file exports at its top level: interfaces, types,
 * functions (one name for all overloads), constants, classes and enums.
 */
function declaredNames(text) {
  const names = new Set();
  const declaration =
    /^export\s+(?:declare\s+)?(?:interface|type|function|const|let|class|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gmu;
  for (const match of text.matchAll(declaration)) {
    names.add(match[1]);
  }
  return names;
}

/** Each name exported by more than one of `sets` (a map of entry → names). */
function sharedNames(sets) {
  const owner = new Map();
  const shared = [];
  for (const [entry, names] of sets) {
    for (const name of names) {
      if (owner.has(name)) {
        shared.push(`${name}: ${owner.get(name)} and ${entry}`);
      } else {
        owner.set(name, entry);
      }
    }
  }
  return shared;
}

describe('ui-components entry points', () => {
  it('export no value under the same name twice', async () => {
    const sets = [];
    for (const entry of ENTRY_POINTS) {
      const module = await import(new URL(`${entry}/index.js`, SRC).href);
      sets.push([entry, Object.keys(module)]);
    }
    expect(sharedNames(sets)).toEqual([]);
    const root = await import(new URL('index.js', SRC).href);
    const total = sets.reduce((sum, [, names]) => sum + names.length, 0);
    expect(Object.keys(root).length).toBe(total);
  });

  it('declare no type or value under the same name twice', () => {
    const sets = ENTRY_POINTS.map((entry) => [
      entry,
      declaredNames(readFileSync(new URL(`${entry}/index.d.ts`, SRC), 'utf8')),
    ]);
    for (const [entry, names] of sets) {
      expect({ entry, some: names.size > 0 }).toEqual({ entry, some: true });
    }
    expect(sharedNames(sets)).toEqual([]);
  });

  it('reads the names of overloads, interfaces and types once', () => {
    const names = declaredNames(
      [
        'export interface LinkPoint { x: number }',
        'export type View = { k: number };',
        'export function f(a: string): void;',
        'export function f(a: number): void;',
        'export declare const MARKERS: object;',
        '  export interface Nested {}',
      ].join('\n')
    );
    expect([...names]).toEqual(['LinkPoint', 'View', 'f', 'MARKERS']);
  });
});
