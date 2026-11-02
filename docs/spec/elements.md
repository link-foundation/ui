# Elements

## Element model

An **element** is a link whose id is the element id and whose first value is
its **kind**:

```lino
(id: kind positional-values... (property ...)... child-elements...)
```

For example:

```lino
(app: document
  (title 'Links UI demo')
  (body: stack
    (direction vertical)
    (greeting: text 'Hello, links')
    (ok: button (label 'OK') (on press (navigate home)))))
```

- The kind MUST be the first value of the element link, and it MUST be a
  reference (an atom). An element link whose first value is not an atom gets
  the error `missing-kind`.
- The kind is never encoded in the id. `button.save:` is just an id that
  contains a dot; a dot in an element id has no meaning (see
  [ordering-and-ids.md](ordering-and-ids.md)). This decides research section
  6.5, first question: the kind is the first value, so ids stay clean;
  queries such as "all buttons" select on the kind field of the tree.
- A kind that is not declared in [vocabulary.lino](vocabulary.lino) gives the
  warning `unknown-kind`. The element is still projected (all its sublinks
  are then unknown, because no property is declared for it) and renderers
  MUST show it as an inert placeholder (see [limits.md](limits.md)).

## Reading the remaining values

After the kind, each value of an element link MUST be classified in source
order by the first matching rule:

1. A **path link** (a link without an id whose first value is itself a link)
   is folded onto the element or property it names, as described in
   [projection.md](projection.md).
2. An **atom** is a **positional value** and is appended to `positional`:
   `(greeting: text 'Hello, links')` has the positional value `Hello, links`.
   The vocabulary MAY name positional values (`(positional label)` for
   `button`); the tree keeps them in `positional` and does not rewrite them
   into properties.
3. A **sublink with an id** (`(body: stack ...)`) is a **child element**.
4. A **sublink without an id** whose head (first value) is declared as a
   property of the parent kind in `vocabulary.lino` is a **property**. Its
   remaining values are the property values.
5. Otherwise, a sublink without an id whose head is a registered kind is an
   **anonymous child** element with `"id": null`: `(text 'First')` inside a
   `stack`.
6. Otherwise the sublink MUST be kept as one value (its JSON value) in the
   element's `unknown` list and MUST produce the warning `unknown-sublink`,
   which points at the element id and the head. Lines indented under it are
   folded into that value, so all three forms keep the same `unknown` list
   ([projection.md](projection.md#unknown-sublinks-with-indented-lines)).

Property lookup (rule 4) wins over kind lookup (rule 5). The `asset` kind
declares a property named `kind`, so `(kind icon)` inside an `asset` is a
property. A head that is a kind but is not a property of the parent, such as
`text` inside a `stack`, is a child.

A top-level link without an id is an anonymous element when its head is a
kind; otherwise it is kept in the document-level `unknown` list with the
warning `unknown-sublink` (its `at.element` is `null`).

If the vocabulary declares `(children none)` for a kind, a child of such an
element gives the warning `unexpected-child`; the child is still kept.

Every kind has the property `note` (a `common-property` of the dialect in
[vocabulary.lino](vocabulary.lino)): one or more strings that explain the
element to a reader, such as `(note 'Why this is red')`. A note is part of the
tree, so unlike a `#` comment it is kept by any tool that rewrites the
document. Renderers MAY ignore it.

## JSON form

Each element MUST be projected to this JSON object (see
[element-tree.schema.json](element-tree.schema.json)):

```json
{
  "id": "ok",
  "kind": "button",
  "positional": [],
  "properties": [{ "name": "label", "values": ["OK"] }],
  "children": [],
  "unknown": []
}
```

The document is `{ "spec": "ui-dialect/0", "elements": [...], "diagnostics": [...] }`,
with an optional top-level `unknown` list. `elements` holds the top-level
elements in source order.

Fixtures: `elements/`, `properties/property-or-child`, `errors/unknown-sublink`.
