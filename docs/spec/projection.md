# Tree projection

`links-notation` gives the same UI document three different shapes depending
on how it is written (measured with 0.27.1; see
[`experiments/issue-1/lino-parse-shapes.mjs`](../../experiments/issue-1/lino-parse-shapes.mjs)
and [`experiments/issue-11/dump.mjs`](../../experiments/issue-11/dump.mjs)):

| Written as                       | `parse()` returns                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| one line                         | one nested link `(ok: button (label OK) (on press (navigate home)))`                                   |
| several lines inside parentheses | one anonymous link holding the head and **path links**: `((ok: button) ((ok: button) (label OK)) ...)` |
| indented, without parentheses    | separate top-level links: `(ok: button)`, `((ok: button) (label OK))`, ...                             |

The multi-line expansion is the intended upstream behaviour: since
links-notation [#282](https://github.com/link-foundation/links-notation/issues/282)
a parenthesised group opens a nested context with the same line rules as the
file root.

Documents SHOULD be written in the indented form, also called the nested
form, with as few parentheses as possible
([#133](https://github.com/link-foundation/ui/issues/133)). Writers
(`format` and `formatLinks` of ui-core) produce it by default. The one-line
and multi-line forms stay valid input, and the examples below use them to
show the shapes.

The **tree projection** turns all three shapes into one element tree.
Implementations MUST produce byte-identical tree JSON for the three forms of
one document; the `shapes/` fixtures prove it.

## Path folding

Implementations MUST project `parse()` output by **path folding**:

- A **path link** is a link without an id whose first value is a link. Its
  first value is the **path** and the remaining values are the **payload**.
- A path names a node: an element head (`(ok: button)`, an element link with
  only its atom values), a property head (`(track opacity)`), or a path link
  made of them (`((ok: button) (on press))`), compared **structurally** (same
  ids, same values in the same order, recursively).
- If the path is structurally equal to an already-seen head or path, the
  payload values are appended, in order, to the node it names, using the
  normal rules of [elements.md](elements.md) (for an element) or as further
  values (for a property).
- A **group wrapper** is a path link `(H (H a) (H b) ...)` with at least one
  payload value whose payload values are all path links with the same path
  `H`. It is what the parser returns for a group written over several lines
  inside parentheses. Its head `H` is **always declared anew** in the current
  context (as a child element, a property, a nested value or an unknown
  sublink, by the rules of [elements.md](elements.md)), even when an equal
  head is already known, so two multi-line `(on press ...)` handlers or two
  multi-line `(text 'Item' ...)` children stay two nodes. A declared head
  names its own node, so the payload paths `(H a)`, `(H b)` fold into that
  new node and never declare `H` a second time.
- If the path is not yet known but is itself an element head or a property
  head valid in the current context, or a path link whose own path is known
  or valid there, it is first declared there (as a child element or
  property) and then receives the payload.
- Otherwise the path link is not foldable: the **whole** path link is kept,
  once, as one value of `unknown` with the warning `unknown-sublink` whose
  `head` is `null`. Its path is not placed on its own, so it adds no second
  `unknown` value and no second warning: `((x y) z)` in a `button` gives
  `unknown: [[["x", "y"], "z"]]` and one warning.

## Unknown sublinks with indented lines

An unknown sublink (rule 6 of [elements.md](elements.md)) may have lines
indented under it. The indented and multi-line forms split it into a head and
path links, so keeping each of those links "verbatim" would give a different
`unknown` list for each form. Three-form equality wins, and the indented form
is the one documents SHOULD be written in:

- The unknown sublink becomes **one** value of `unknown` (its JSON value, as
  in the one-line form) and gives **one** `unknown-sublink` warning with its
  `head`.
- Like a property value, it is a node that later path links can name: the
  lines indented under it, and the links nested under those, are appended to
  it at the same depth as in the one-line form.

```lino
ok: button
  label OK
  colour red
    shade dark
      tone deep
```

gives `unknown: [["colour", "red", ["shade", "dark", ["tone", "deep"]]]]` and
one warning, the same as `(ok: button (label OK) (colour red (shade dark (tone deep))))`.

Element heads are looked up document-wide (element ids are unique). Property
heads are looked up only inside their own element, so `(label OK)` in two
buttons cannot collide.

`parseGroups()` MAY be used where an implementation offers it; the result
MUST be identical to path folding of `parse()`.

## Algorithm

```text
project(links):
  root := new document; known := empty map (structural key -> node)
  for link in links: place(root, link)
  return root

place(node, link):                        # node is an element, the root or a value node
  if link is a path link (no id, first value is a link):
    path := first value of link
    if link is a group wrapper: target := none
    else: target := lookup(node, path)    # local heads first, then document-wide
    if target is none:
      if link is not a group wrapper and path is not declarable in node:
        keep link once in node.unknown (or as a value of a value node)
        warn unknown-sublink (head null, not for a value node); return none
      target := place(node, path)
    for value in rest of link:
      created := place(target, value)
      remember (path value) -> created
    return target
  if node is a value node (property, unknown sublink or nested value):
    append value-json(link) to its values
    return a new value node for link, remembered under link (none for an atom)
  if link is an atom: append it to node.positional; return none
  if link has an id: return new child element (id, kind = first value, rest placed in it)
  head := first value of link
  if head is a declared property of node.kind: return new or replaced property
  if head is a registered kind: return new anonymous child element
  keep link in node.unknown; warn unknown-sublink (head); return it as a value node
```

Every node created from a head is remembered under that head both in the
node it was placed in and in itself.

The top-level root behaves as an element that accepts only elements.

## Worked example

The indented text

```lino
ok: button
  label OK
  on press
    navigate home
```

gives four links from `parse()`:

```lino
(ok: button)
((ok: button) (label OK))
((ok: button) (on press))
(((ok: button) (on press)) (navigate home))
```

Folding them:

1. `(ok: button)` declares the element `ok` of kind `button`.
2. `((ok: button) (label OK))` has the path `(ok: button)`, which is known; the
   payload `(label OK)` is a declared `button` property, so `ok` gets the
   property `label` with the value `OK`.
3. `((ok: button) (on press))` appends the property `on` with the value
   `press`, and remembers the path `((ok: button) (on press))` for that
   property.
4. `(((ok: button) (on press)) (navigate home))` has the known path
   `((ok: button) (on press))`; its payload `(navigate home)` is appended to
   the values of that `on` property.

The result equals the one-line form `(ok: button (label OK) (on press (navigate home)))`:

```json
{
  "id": "ok",
  "kind": "button",
  "positional": [],
  "properties": [
    { "name": "label", "values": ["OK"] },
    { "name": "on", "values": ["press", ["navigate", "home"]] }
  ],
  "children": [],
  "unknown": []
}
```

Fixtures: `shapes/button.*`, `shapes/form.*` (nested elements and several
actions), `shapes/track.*` (a multi-line property value),
`shapes/nested-anonymous.*` (a multi-line anonymous child with properties),
`shapes/unfoldable-path.*` (a path link that is kept once in `unknown`),
`shapes/unknown-children.*` (an unknown sublink with indented lines),
`samples/document` and `samples/indented`.
