# Doublet configurations and gallery

Import pure helpers from
`@link-foundation/ui-components/links-view/configurations` (safe without a DOM):

```js
import {
  codeAt,
  decode,
  indexOf,
  parseLinks,
  formatLinks,
  representatives,
  classCount,
} from '@link-foundation/ui-components/links-view/configurations';

codeAt(2, 80n); // '22 22'
indexOf(decode(codeAt(12, '100000000000000000000'))); // 100000000000000000000n
parseLinks('(1: 0 1) (2: 2 0)'); // {links: [[0, 1], [2, 0]]}
formatLinks([
  [0, 1],
  [2, 0],
]); // nested LiNo, written with ui-core
representatives(2).length; // 45
classCount(4); // 16900n
```

Networks are arrays of source/target pairs. References are integers `0..n`;
zero is free and link names are one-based. `count`, `indexOf` and `classCount`
return BigInt. Index inputs accept BigInt, decimal strings or safe integers;
unsafe Number inputs are refused. `{real: true}` uses only references `1..n`
and base `n` for indexing. `randomCode(n, {real, random})` samples each digit
with an injectable `[0,1)` random source, avoiding a floating point index.

`encode`/`decode` use `01 20` through nine links and `s,t;s,t` above nine.
`decode` also accepts compact, dash and dot forms. It throws on invalid input;
`parseCode` provides the nonthrowing `{links}` or `{error}` parser contract.
`parseTheory`/`formatTheory`, `parsePairs`/`formatPairs`,
`parseNumber`/`formatNumber`, `parseDecimal(text, n, options)`/`formatDecimal`
and `parseLinks`/`formatLinks` use that contract for their readers.
`configurationMessages.en` and `.ru` map error keys to explanations.
Theory formatters accept `{set: 'λ' | 'L' | 'R'}`; readers also accept an
optional leading `N²=`. Number and pair bases always equal `n + 1`, including
real-only networks; decimal indexing accepts `{real}`.

Editing helpers return fresh arrays: `addLink`, `setReference(links, k, end, value)`
(`end` is `source`, `target`, `0` or `1`), and `step(links, ±1)` across sizes.
Stepping back at `00` stays there. `removeLink(links, k)` returns
`{links, indexMap}`: the map carries surviving old names to new names, omits the
removed name and is the identity for a one-link network. `relabel` takes an
array of new names in old-name order. `canonical` returns the smallest code
in numeric counting order over all renamings, practical through seven links.
`representatives` uses an orbit bitmap and returns sorted pair arrays; it is
intended for small networks and refuses counts beyond array capacity.
`classCount` uses Burnside's lemma without enumerating networks.

Register `defineLinksGallery(window)` from the `links-view` entry point, then use:

```html
<links-gallery size="2" lang="en"></links-gallery>
```

Set `gallery.urlFor = ({code, index, links, size, real, theme}) => url` to supply
each card's HTTP(S) destination; `index` is a lossless decimal string. Without a
callback cards are previews. The `classes` and `real` boolean attributes select
filters; `theme` is passed to thumbnails and the callback. English and Russian
labels use `Intl.PluralRules` and `Intl.NumberFormat`. The gallery offers keyboard
size tabs (1..4), a counting formula, 64 px network thumbnails and pages of 243.
Each gallery owns its enumeration cache. Thumbnail instances reuse
`defineLinksNetwork` with `{worker: false}` for bounded synchronous layouts.

Run the example at `packages/ui-components/examples/links-gallery.html` through
the repository static server. `node --max-old-space-size=256
experiments/issue-229-configurations.mjs` measures the four-link criterion.
