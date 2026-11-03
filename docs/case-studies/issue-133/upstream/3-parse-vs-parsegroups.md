## Summary

`Parser.parse` and `Parser.parseGroups` read the indented id syntax `x:` followed by one-word lines differently:

- `parse` makes the lines references (values of `x`).
- `parseGroups` makes each line a one-value link.

Under any other head line, both make the lines one-value links. A nested writer therefore has to add parentheses only in this case.

Found in link-foundation/ui (issue link-foundation/ui#133, pull request link-foundation/ui#134). Reproduced with `links-notation` 0.27.1 and 0.30.0.

## Reproduction

```js
import { Link, Parser } from 'links-notation';

const parser = new Parser();
const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;

const text = 'x:\n  a\n  b';
console.log(
  parser
    .parse(text)
    .map((l) => l.format())
    .join(' | ')
); // (x: a b)
console.log(
  parser
    .parseGroups(text)
    .map(unindent)
    .map((l) => l.format())
    .join(' | ')
); // (x: (a) (b))

const other = 'x: kind\n  a\n  b';
console.log(
  parser
    .parse(other)
    .map((l) => l.format())
    .join(' | ')
); // (x: kind) | ((x: kind) (a)) | ((x: kind) (b))
console.log(
  parser
    .parseGroups(other)
    .map(unindent)
    .map((l) => l.format())
    .join(' | ')
); // (x: kind (a) (b))
```

Script and output: [probe-upstream-groups.mjs](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-groups.mjs), [0.30.0 output](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-groups.0.30.0.txt).

## Expected

Either:

- `parseGroups` gives the group of `x:` the same values that `parse` gives `x` (references `a` and `b`), or
- the README documents that the indented id syntax is read differently by the two methods, and which one is canonical.

## Suggested fix

In `parseGroups`, when the element is a bare `id:` line, add each child line that is a single reference as a reference, as `parse` does. Then add a test that `parse` and `parseGroups` + unindent agree on the indented id fixtures.

## Workaround

ui-core's nested writer puts a lone reference under a bare `name:` line in parentheses, `(a)`, so both readings agree: `nestedLines` in [packages/ui-core/src/format.js](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/packages/ui-core/src/format.js).
