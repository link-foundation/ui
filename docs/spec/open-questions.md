# Open questions

Every point that `ui-dialect/0` does not decide is listed here with its
alternatives and the issue that owns the decision. Until an owner issue
decides otherwise, implementations MUST follow the v0 rule given for each
point and MUST NOT invent their own.

## Gap coverage

Each gap of research section 5 and each decision of section 6.5 of
[links-notation-ecosystem.md](../case-studies/issue-1/research/links-notation-ecosystem.md)
is either decided in a spec document or listed below.

| Gap                                       | Status                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 5.1 Typed values                          | Decided: schema-driven typing, [values.md](values.md); `quoted` flag below                              |
| 5.2 Units and colours                     | Decided: [values.md](values.md)                                                                         |
| 5.3 `:` in values (and `#`)               | Decided: structured links and quoting, [values.md](values.md)                                           |
| 5.4 Comments on round trip                | Decided: source-preserving edits and `note`, below (#22)                                                |
| 5.5 Ordering                              | Decided: [ordering-and-ids.md](ordering-and-ids.md)                                                     |
| 5.6 Ids and scoping                       | Decided for one document, [ordering-and-ids.md](ordering-and-ids.md); cross-document and doublets below |
| 5.7 Reference sigils                      | Decided: structured references, `@` / `$` reserved, [values.md](values.md)                              |
| 5.8 Schemas and validation                | Decided for v0: [vocabulary.lino](vocabulary.lino); the schema language is open, below (#23)            |
| 5.9 Expressions and bindings              | `on` and actions decided, `bind` reserved, [behaviour.md](behaviour.md); `when` and expressions below   |
| 5.10 Missing languages                    | Owned by #29 (Swift) and #31 (Kotlin); both MUST pass `fixtures/`                                       |
| 5.11 Security                             | Decided: [limits.md](limits.md), [behaviour.md](behaviour.md)                                           |
| 6.5 Kind as first value or id prefix      | Decided: first value, [elements.md](elements.md)                                                        |
| 6.5 Inline style or named style reference | Open, below (#20)                                                                                       |
| 6.5 Typed codec or core parser + schema   | Decided: core parser + vocabulary, [values.md](values.md)                                               |

## Comments and layout on round trip

`links-notation` drops comments and layout, so an editor that writes a
document back loses them.

- (a) A concrete syntax tree mode upstream (trivia and source spans).
- (b) Comments as first-class links, for example `(note 'text')`.
- (c) Patch-in-place edits using parser positions.

Decided by #22, all three:

- (c) `@link-foundation/ui-core/source` edits the text in place: it maps every
  element, property and value to its span, changes only those bytes, and
  checks after each edit that the new text parses to the expected tree.
  Comments, blank lines and layout around the edit are kept, and a comment on
  the lines directly above a node moves or is removed with it.
- (b) `note` is a property of every kind (`common-property` in
  [vocabulary.lino](vocabulary.lino)): `(note 'Why this is red')` is part of
  the tree, so it survives `parse` and `format` and any tool that rewrites a
  document. A `#` comment carries no meaning.
- (a) The spans in (c) are found by a small delimiter scanner that every span
  is checked against. It is a stopgap: when `links-notation` reports source
  positions, the spans come from the parser and the scanner goes. The
  proposal for upstream is in the pull request of #22.

Tools that rewrite documents without the source edits MAY still lose `#`
comments; they MUST keep `note` properties.

## A `quoted` flag on parsed references

The parser loses the difference between `1` and `'1'`, which forces
schema-driven typing.

- (a) Keep schema-driven typing only (the v0 rule).
- (b) Ask upstream to keep a `quoted` flag, then allow "bare means number,
  quoted means string" for free-form `any` properties in a later version.

Owner: upstream request
[link-foundation/links-notation#364](https://github.com/link-foundation/links-notation/issues/364),
then #15 for the typed value reader.

## Multi-line path expansion

A line break inside parentheses produces path links, not one nested link
(see [projection.md](projection.md)).

- (a) Treat it as intended and fold paths (the v0 rule).
- (b) Ask upstream for an option that returns one nested link.

Status: intended upstream behaviour since
[link-foundation/links-notation#282](https://github.com/link-foundation/links-notation/issues/282)
("make `( )` open a nested context that follows exactly the same rules as the
root"), so no new upstream issue is needed. Owner of the projection code: #14.

## Cross-document ids

Overrides (`(base app)`), themes (`(theme material3)`, `(extends base)`) and
animations (`(target ok)`) refer to ids that live in other documents.

- (a) One global id space per application.
- (b) Qualified references such as `(ref document-id element-id)`.
- (c) Import links that bring another document's ids into scope.

Owner: #18 (layered configuration and override patches). v0 rule: ids are
unique per document; an element reference that is not defined in the same
document is not an error.

## Namespaces, id scopes and doublet mapping

Whether components get nested id scopes (`login.save`), how element ids and
the element tree map onto links-theory doublets, and how ids stay stable
across edits for selection, undo and collaboration.

- (a) Each element is a doublet `(id kind)`, each property a doublet from the
  element to a value link, children ordered by a sequence link.
- (b) Store the projected tree as-is and keep a separate id-to-address index.

Owner: #16 (links network store with stable ids). v0 rule: ids are opaque and
document-global; dots have no meaning.

## Expressions and conditions

`(when (param sending) (show spinner))`, computed values and whether they reuse
the linksql substitution syntax.

- (a) A small closed expression vocabulary as links (comparison, not, and, or).
- (b) Reuse linksql substitution.
- (c) Keep logic in host code and expose only named state.

Owner: #33 (behaviour state machines and actions registry). v0 rule: `when`
and `bind` are reserved names; nothing is evaluated.

## Inline styles or named style references

Research section 6.5, second question.

- (a) Inline style properties on elements.
- (b) Always a reference to a named `style` link (deduplicates better and maps
  better to doublets).

Owner: #20 (style rules). v0 rule: `style` elements are separate named
links; elements MAY refer to them with `(style <id>)`.

## Schema language

`vocabulary.lino` declares kinds, property types, multi-valued properties and
actions, but not defaults, ranges, documentation or presets.

Owner: #23 (settings schema engine), which grows `vocabulary.lino` into a
schema language.

## Boolean and integer types

`values.md` has no `boolean` or `integer` type: `disabled` is
`(enum true false)` and counts are plain `number` values, so a schema cannot
say "whole numbers only" and a renderer has to compare the strings `'true'`
and `'false'`.

- (a) Add `boolean` and `integer` to the property types of `vocabulary.lino`.
- (b) Keep `(enum true false)` and express ranges and whole numbers in the
  schema language.

Owner: #23 (settings schema engine), with #15 (typed values). v0 rule:
`disabled` is `(enum true false)` and types as `{ type: 'enum', value: 'true' }`.
The ui-core value layer already reads a `boolean` type name
(`{ type: 'boolean', value: true }`) for vocabularies that declare one; no
`integer` type is read yet.

## Asset record fields

The `asset` kind lists the fields used by the samples (`kind`, `source`,
`license`, `copyright`, `notice`). Owner of the final field set: #10.

## Icon element kind

`vocabulary.lino` has no `icon` kind. `@link-foundation/ui-components` (#44)
declares one in `ICON_KIND_TEXT`. Its forms are `(icon close)`, with the name as
the first positional value, and `(icon (set lucide) (name check) (label 'Done'))`.
It has these properties:

- `name`, `set`, `label` and `note`: `string`;
- `mirror`: `(enum true false)`.

`iconVocabulary()` adds the kind to the default vocabulary.

- (a) Add the `icon` kind to `vocabulary.lino` as declared there.
- (b) Make `icon` a property of other kinds (`(button (icon close))`).
- (c) Both.

Owner: #44 for the kind as declared. Deciding the core vocabulary is left to
a later dialect version. v0 rule: documents that use `(icon ...)` are parsed
with `iconVocabulary()`. With the default vocabulary, `icon` is an unknown
kind and a warning is reported.
