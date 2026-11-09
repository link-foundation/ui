import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCode,
  codeAt,
  indexOf,
  decode,
  encode,
  count,
  randomCode,
  parseTheory,
  formatTheory,
  parsePairs,
  formatPairs,
  parseNumber,
  formatNumber,
  parseDecimal,
  formatDecimal,
  parseLinks,
  formatLinks,
  addLink,
  removeLink,
  setReference,
  step,
  canonical,
  relabel,
  representatives,
  classCount,
  configurationMessages,
} from '../../src/links-view/configurations.js';

const sample = [
  [0, 1],
  [2, 0],
];
it('indexes all small networks and preserves large indexes', () => {
  assert.equal(codeAt(2, 0), '00 00');
  assert.equal(codeAt(2, 80), '22 22');
  for (const real of [false, true]) {
    assert.deepEqual(
      [1, 2, 3, 4].map((n) => count(n, { real })),
      (real ? [1, 16, 729, 65536] : [4, 81, 4096, 390625]).map(BigInt)
    );
    for (let i = 0n; i < count(3, { real }); i++) {
      assert.equal(indexOf(decode(codeAt(3, i, { real })), { real }), i);
    }
    const index = `1${'0'.repeat(20)}`;
    assert.equal(
      indexOf(decode(codeAt(12, index, { real })), { real }).toString(),
      index
    );
  }
  assert.equal(encode(decode('11 22 12')), '11 22 12');
  assert.throws(() => codeAt(2, Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => codeAt(2, 81));
  assert.throws(() => indexOf([[0, 0]], { real: true }));
});
it('samples every digit without converting a whole index to Number', () => {
  let calls = 0;
  const code = randomCode(12, { random: () => (++calls % 2 ? 0 : 0.99) });
  assert.deepEqual(
    decode(code),
    Array.from({ length: 12 }, () => [0, 12])
  );
  assert.equal(calls, 24);
  assert.equal(randomCode(2, { real: true, random: () => 0 }), '11 11');
  assert.throws(() => randomCode(2, { random: () => 1 }));
});
it('parses and formats every notation, including all theory arrows', () => {
  for (const text of ['0120', '01-20', '01.20', '01 20']) {
    assert.deepEqual(decode(text), sample);
  }
  for (const arrow of ['↦', '->', '→', '=>', ':']) {
    assert.deepEqual(
      parseTheory(`N²= L = {2 ${arrow} (2, 0), 1 ${arrow} (0, 1)}`),
      { links: sample }
    );
  }
  for (const [parse, format] of [
    [parseTheory, formatTheory],
    [parsePairs, formatPairs],
    [parseNumber, formatNumber],
    [parseLinks, formatLinks],
  ]) {
    assert.deepEqual(parse(format(sample)), { links: sample });
    const large = Array.from({ length: 12 }, () => [12, 10]);
    assert.deepEqual(parse(format(large)), { links: large });
  }
  assert.equal(
    formatTheory(sample, { set: 'R' }),
    'R = {1 ↦ (0, 1), 2 ↦ (2, 0)}'
  );
  assert.deepEqual(parseNumber('0120₃'), { links: sample });
  assert.deepEqual(parseNumber('0120_3'), { links: sample });
  assert.deepEqual(parseLinks('(1: 0 1) (2: 2 0)'), { links: sample });
  assert.deepEqual(parseLinks('1: 0 1\n2: 2 0'), { links: sample });
  assert.deepEqual(parseLinks('(0 1) (2 0)'), { links: sample });
  assert.deepEqual(parseDecimal(formatDecimal(sample), 2), { links: sample });
});
it('returns localisable, specific errors', () => {
  const cases = [
    [parseNumber('0120₄'), 'base'],
    [parseLinks('(1: 0 3)'), 'reference'],
    [parseLinks('(1: 0 1) (3: 2 0)'), 'name'],
    [parseLinks('(1: 0 1) (1: 2 0)'), 'name'],
    [parseLinks('(1: 0 1) (2 0)'), 'name'],
    [parseNumber('012₃'), 'digits'],
    [parsePairs('01₄ 20₃'), 'base'],
    [parseDecimal('81', 2), 'index'],
    [parseTheory('λ = {1 ↦ (0, 1), 1 ↦ (2, 0)}'), 'name'],
  ];
  for (const [result, key] of cases) {
    assert.equal(result.error, `configurations.${key}`);
    for (const locale of ['en', 'ru']) {
      assert.ok(configurationMessages[locale][result.error]);
    }
  }
});
it('edits immutably with a map for per-link options and steps across sizes', () => {
  assert.deepEqual(addLink(sample), [...sample, [0, 0]]);
  assert.deepEqual(setReference(sample, 1, 'target', 2), [
    [0, 2],
    [2, 0],
  ]);
  const removed = removeLink(
    [
      [0, 1],
      [2, 0],
      [3, 2],
    ],
    2
  );
  assert.deepEqual(removed.links, sample);
  assert.deepEqual(
    [...removed.indexMap],
    [
      [1, 1],
      [3, 2],
    ]
  );
  assert.deepEqual(removeLink([[1, 1]], 1).links, [[1, 1]]);
  assert.deepEqual(
    removeLink(
      [
        [2, 3],
        [1, 2],
        [3, 1],
      ],
      2
    ).links,
    [
      [0, 2],
      [2, 1],
    ]
  );
  assert.equal(encode(step(decode('22 22'), 1)), '00 00 00');
  assert.equal(encode(step(decode('00 00 00'), -1)), '22 22');
  assert.equal(encode(step([[0, 0]], -1)), '00');
  assert.deepEqual(sample, [
    [0, 1],
    [2, 0],
  ]);
});
it(
  'computes Burnside counts and orbit representatives through n=4',
  { timeout: 10000 },
  () => {
    for (const real of [false, true]) {
      const expected = real ? [1n, 10n, 129n, 2836n] : [4n, 45n, 720n, 16900n];
      assert.deepEqual(
        [1, 2, 3, 4].map((n) => classCount(n, { real })),
        expected
      );
      for (let n = 1; n <= 4; n++) {
        const reps = representatives(n, { real });
        assert.equal(BigInt(reps.length), expected[n - 1]);
        assert.equal(new Set(reps.map(encode)).size, reps.length);
        for (const links of reps.slice(0, 20)) {
          assert.equal(canonical(links), encode(links));
        }
      }
    }
    assert.equal(canonical(sample), canonical(relabel(sample, [2, 1])));
    assert.throws(() => relabel(sample, [1, 1]));
    assert.equal(
      canonical(Array.from({ length: 7 }, (_, i) => [i + 1, 0])),
      '10 20 30 40 50 60 70'
    );
  }
);

it('exports a DOM-free package subpath and nonthrowing code parser', async () => {
  const api =
    await import('@link-foundation/ui-components/links-view/configurations');
  assert.equal(api.codeAt(2, 80n), '22 22');
  assert.deepEqual(parseCode('01 20'), { links: sample });
  assert.deepEqual(parseCode('01 30'), { error: 'configurations.reference' });
  assert.deepEqual(parseCode('012'), { error: 'configurations.digits' });
  assert.deepEqual(parseCode('hello'), { error: 'configurations.syntax' });
  const ten = Array.from({ length: 10 }, () => [10, 0]);
  assert.equal(formatPairs(ten).split(' ')[0], '(10,0)₁₁');
  assert.deepEqual(parseNumber(formatNumber(ten)), { links: ten });
  assert.deepEqual(parsePairs(formatPairs(ten)), { links: ten });
});
