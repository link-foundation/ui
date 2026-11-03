// Probe: how ui-core projects a story file (the story format of the basic controls).
import { projectLinks } from '@link-foundation/ui-core';
import { Parser } from 'links-notation';
const text = `(button-stories: stories
  (component button)
  (story filled (button 'Save' (variant filled)))
  (story disabled (button (label 'Save') (disabled true))))`;
const kind = (names) => ({
  positional: [],
  children: 'any',
  properties: new Map(
    names.map((n) => [n, { type: 'any', multi: n === 'story' }])
  ),
});
const BOOT = {
  version: null,
  kinds: new Map([['stories', kind(['component', 'story'])]]),
  actions: new Map(),
  multiValued: new Set(),
};
const { roots, diagnostics } = projectLinks(new Parser().parse(text), BOOT);
console.log(diagnostics);
console.log(JSON.stringify(roots, null, 1).slice(0, 2500));
const t2 = `(radio-group-stories: stories
  (component radio-group)
  (story default (radio-group (label Size) (value m)
    (s: radio (label Small) (value s))
    (m: radio (label Medium) (value m)))))`;
const r2 = projectLinks(new Parser().parse(t2), BOOT);
console.log(r2.diagnostics, JSON.stringify(r2.roots[0].properties[1].values));
