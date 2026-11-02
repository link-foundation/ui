# Upstream Links Notation parity corpus

`text-fixtures.json` is a byte-equal copy of
[`parity/text-fixtures.json`](https://github.com/link-foundation/links-notation/blob/3c2ee720b1cece421cb511d0c840cd3e2e3c7ccf/parity/text-fixtures.json)
from [link-foundation/links-notation](https://github.com/link-foundation/links-notation)
at commit `3c2ee720b1cece421cb511d0c840cd3e2e3c7ccf` (the `links-notation`
0.27.1 JavaScript package is built from the same sources). It is public domain
under the Unlicense, like this repository.

It is the golden corpus of the upstream cross-language contract: 14 cases of
`{id, feature, input, expected: [{id, values}], format}`, with `id: null` for
an anonymous link. The native parsers vendored under `native/` (see
[`docs/native-parsers.md`](../../docs/native-parsers.md)) run every case for
parse, format and round trip. `tests/native-parity-corpus.test.js` checks that
the JavaScript `links-notation` package pinned in `package.json` still agrees
with every case, so a dependency update that changes the contract fails here
first.

To update it, copy the file from the new upstream commit, update the commit
above and run `npm test`.
