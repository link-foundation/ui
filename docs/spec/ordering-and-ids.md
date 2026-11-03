# Ordering and ids

## Sequences

The following MUST keep source order and MUST NOT be reordered by any
implementation, editor or exporter:

- the children of an element;
- the positional values of an element;
- the values inside one property;
- the occurrences of a **multi-valued property**. The v0 multi-valued
  properties are listed in the `multi-valued` link of
  [vocabulary.lino](vocabulary.lino): `on`, `token`, `track`, `key`,
  `event`, `set`, `state` and `media`. (`key` appears inside `track`
  values; it is listed so that tools treat keyframes as a sequence.)

```lino
ok: button
  on press
    emit pressed
  on focus
    emit focused
  on press
    navigate home
```

keeps three `on` properties in this order (fixture
`properties/multi-valued-order`).

## Sets

Single-valued properties form a set: their meaning does not depend on their
order. The tree still keeps them in source order so that the projection is
deterministic.

A repeated single-valued property MUST be resolved as **last wins**: the
earlier occurrence is removed, the later one stays at its own source position,
and the warning `duplicate-property` points at the element and the property
(fixture `properties/duplicate-property`).

## Element ids

- Element ids MUST be unique per document. A second element with an id that is
  already used MUST give the error `duplicate-id`
  (`links-notation` itself does not detect `(a: b)` followed by `(a: c)`;
  fixture `errors/duplicate-id`).
- Ids are case-sensitive strings. A dot in an element id has no meaning:
  `button.save` is one opaque id, not a namespace and not a kind (fixture
  `elements/kind-is-first-value`).
- Anonymous elements (`"id": null`) cannot be referenced.
- A dot in a **token** name is a path separator (see [values.md](values.md)).

Namespaces, nested id scopes per component, references across documents and
the mapping of ids to doublet addresses are not part of v0; see
[open-questions.md](open-questions.md).
