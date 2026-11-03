## Summary

No formatting option writes the nested (indented) form recursively. The indented output of `FormatOptions` does not always read back as the same links.

Found in link-foundation/ui (issue link-foundation/ui#133, pull request link-foundation/ui#134), which now writes all of its Links Notation in the nested form. It had to add its own writer for that. Reproduced with `links-notation` 0.27.1 and 0.30.0.

## Reproduction

```js
import { Parser, FormatOptions, formatLinks } from 'links-notation';

const parser = new Parser();
const options = new FormatOptions({
  lessParentheses: true,
  maxInlineRefs: 1,
  preferInline: false,
});

// 1. An anonymous link is written as indented lines with no head line.
const anonymous = parser.parse('a b c');
const text = formatLinks(anonymous, options);
console.log(JSON.stringify(text)); // "  a\n  b\n  c"
console.log(
  parser
    .parse(text)
    .map((l) => l.format())
    .join(' | ')
); // (a) | (b) | (c)

// 2. Values that are links stay inline, even with maxInlineRefs and indentLongLines.
const form = parser.parse(
  "(form: stack (direction vertical) (gap 8px) (save: button 'Save' (on press (emit save) (navigate home))))"
);
console.log(
  formatLinks(
    form,
    new FormatOptions({
      lessParentheses: true,
      maxInlineRefs: 1,
      indentLongLines: true,
      maxLineLength: 20,
    })
  )
);
// form: stack (direction vertical) (gap 8px) (save: button Save (on press (emit save) (navigate home)))
```

Scripts and output:

- [probe-upstream-roundtrip.mjs](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-roundtrip.mjs) and its [0.30.0 output](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-roundtrip.0.30.0.txt)
- [probe-upstream-format.mjs](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-format.mjs) and its [0.30.0 output](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/probe-upstream-format.0.30.0.txt)

## Expected

There is an option, or a function, that writes links in the nested form. A link goes on one line with its atom values, and each value that is itself a link with values goes on its own line, indented under it, recursively:

```
form: stack
  direction vertical
  gap 8px
  save: button Save
    on press
      emit save
      navigate home
```

Reading the text back with `parseGroups`, and appending each group's children to the values of its element, gives the same links.

`formatIndentedDocument` (0.30.0) covers only two levels of plain text.

## Cause

- `Link._formatIndented` writes one level only, formatting each value inline with `formatValue`.
- For `id === null` it writes the values with no head line, so at the root they read as separate links.

## Suggested fix

- Add a recursive writer, e.g. `formatLinks(links, new FormatOptions({ nested: true }))` or `formatNested(links)`.
  - Write the leading atom values on the line.
  - Write the values that are links with values on their own indented lines.
  - Keep parentheses only where a line cannot hold the link: `()`, `((a b))`, and a lone reference under a bare `name:` line, which `parse` reads as a value of `name`.
- Test that `parseGroups` + unindent of the output equals the input, over the existing fixtures.

## Workaround

ui-core has such a writer: `formatLinks(values, { style: 'indented' })` in [packages/ui-core/src/format.js](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/packages/ui-core/src/format.js), read back by `parseNested` in [packages/ui-core/src/links.js](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/packages/ui-core/src/links.js). It is fuzz-tested for round trips in [experiments/issue-133/fuzz-nested-format.mjs](https://github.com/link-foundation/ui/blob/issue-133-adf438e34311/experiments/issue-133/fuzz-nested-format.mjs). It could be moved upstream.
