## Summary

`Link.format(true)` (`lessParentheses`) of an anonymous link whose only value is a link with values drops the parentheses that make it nested. The text reads back as a different link.

Found in link-foundation/ui (issue link-foundation/ui#133, pull request link-foundation/ui#134) while making the nested form the default there. Reproduced with `links-notation` 0.27.1 and 0.30.0.

## Reproduction

```js
import { Parser } from 'links-notation';

const parser = new Parser();
const [link] = parser.parse('((b c))');
const text = link.format(true);
console.log(JSON.stringify(text)); // "(b c)"
console.log(parser.parse(text)[0].format()); // (b c)
console.log(parser.parse(text)[0].equals(link)); // false
```

Script and output: [probe-upstream-roundtrip.mjs](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-roundtrip.mjs), [0.30.0 output](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-roundtrip.0.30.0.txt).

## Expected

`parse(link.format(true))` gives a link equal to `link`, as `parse(link.format())` does. For `((b c))` the text should stay `((b c))`.

## Cause

In `Link.format` (`js/src/Link.js`), the `id === null` branch in `lessParentheses` mode returns `valuesStr` without the outer parentheses whenever any value is not simple. With two or more values this is safe, because the line becomes the anonymous link. With exactly one value that is itself a parenthesized link, the outer link disappears. `_formatWithOptions` has the same branch.

## Suggested fix

Keep the outer parentheses when the anonymous link has exactly one value and that value has values:

```js
if (this.id === null && lessParentheses) {
  const lone = this.values.length === 1 && this.values[0].values?.length > 0;
  if (!lone) return valuesStr; // or the simple-values join as today
}
return `(${valuesStr})`;
```

Then add a round-trip test, `parse(link.format(true))` equal to `link`, over the existing fixtures. Other bindings may have the same branch.

## Workaround

ui-core writes such a link with `Link.format()` (full parentheses) instead of `format(true)`: [packages/ui-core/src/format.js](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/packages/ui-core/src/format.js).
