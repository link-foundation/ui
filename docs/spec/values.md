# Values

## JSON form

The tree keeps values as the parser gives them:

- a reference atom MUST be a JSON string (`OK`, `16px`, `#6750A4`);
- a nested link without an id MUST be a JSON array of its values
  (`(navigate home)` is `["navigate", "home"]`);
- a nested link with an id (not used by any v0 property) MUST be an object
  `{ "id": ..., "values": [...] }`.

Typed parsing (numbers, units, colours) is a later stage owned by #15. The
projection MUST NOT convert value strings.

## Typing is schema-driven

The type of a value MUST come from the property type declared in
[vocabulary.lino](vocabulary.lino), never from the way it is written.
Quoting MUST NOT change a type: `links-notation` gives `(t 1 '1')` as two
equal references `1`, so the quoted / bare distinction is not available (see
`values/quoting-does-not-type`). This decides research section 6.5, third
question: documents are read with the core parser plus the vocabulary, not
with lino-objects-codec. A `quoted` flag upstream is tracked in
[open-questions.md](open-questions.md).

A value that does not match its declared type MUST give the error
`invalid-value`, pointing at the element and the property. Values of type
`string` and `any` are not checked. A value carrying a reserved sigil gets
only `reserved-sigil`.

## Types

| Type                 | Accepted forms                                                                                                                               | Examples                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `string`             | any atom                                                                                                                                     | `'Links UI demo'`                                 |
| `number`             | optional `-`, digits, optional fraction, optional exponent                                                                                   | `-1`, `0.5`, `1.5e3`                              |
| `dimension`          | a number followed by one unit of `px`, `rem`, `em`, `%`, `vw`, `vh`; or `0`                                                                  | `16px`, `1.5rem`, `50%`, `40vh`                   |
| `duration`           | a non-negative number followed by `ms` or `s`                                                                                                | `150ms`, `0.2s`                                   |
| `color`              | a quoted hex `'#RGB'`, `'#RGBA'`, `'#RRGGBB'`, `'#RRGGBBAA'`; or `(oklch l c h)` / `(rgb r g b)`, each with an optional fourth alpha channel | `'#6750A4'`, `'#6750A4CC'`, `(oklch 0.6 0.2 300)` |
| `enum`               | one of the listed atoms, `(enum filled outlined text)`                                                                                       | `filled`                                          |
| `url`                | a quoted URL, or a relative path without `:`                                                                                                 | `'https://example.com/a.svg'`, `hero.png`         |
| `token-ref`          | `(token <dotted.name>)`                                                                                                                      | `(token color.primary)`                           |
| `element-ref`        | a bare element id                                                                                                                            | `ok`                                              |
| `boolean`            | `true` or `false`                                                                                                                            | `true`                                            |
| `element-ref-or-url` | a `url` when the atom has a `:` or a `/`, otherwise an `element-ref`                                                                         | `home`, `/docs`, `'https://example.com'`          |
| `action`             | see [behaviour.md](behaviour.md)                                                                                                             | `(navigate home)`                                 |

A `token-ref`, a `param` reference and an `(or ...)` fallback MAY appear
wherever a typed value is expected; their resolved value is then checked.

## Colours

```lino
(chip: style (background '#6750A4') (color (oklch 0.6 0.2 300)))
(scrim: style (background '#6750A4CC') (color (rgb 103 80 164)))
```

A bare `#` MUST NOT be used: `#` starts a comment, so the comment swallows the
closing parenthesis and `(x #6750A4)` is a syntax error (fixture
`errors/syntax-unquoted-hex`). Hex colours MUST be quoted.

## No `:` in bare values

A `:` inside a bare value is a syntax error (`(t a:b)`; fixture
`errors/syntax-colon-in-value`). Documents MUST use structured links instead,
and MUST quote URLs:

```lino
(narrow: style (state hover (opacity 0.8)) (media (max-width 640px)))
(logo: image 'https://example.com/logo.svg' (aspect 16 9))
```

## References

Canonical v0 references are **structured links**, as in the samples:

- a design token: `(token color.primary)`;
- a component parameter: `(param draft.text)`;
- an element: its bare id, `(target ok)`.

```lino
(card: stack (gap (token space.medium)))
(draft: text (bind value (param draft.text)))
(wave: animation (target hello))
```

The prefixes `@` and `$` are **reserved**. A value that starts with either of
them MUST give the warning `reserved-sigil` and is otherwise kept as a plain
reference, until a later version defines `@token.path` and `$param` as
shorthand for the structured forms (fixture `references/reserved-sigil`).

### Resolution order

A `(token name)` reference MUST be resolved in the active theme first, then
along its `(extends ...)` chain, then in the base theme. The first theme that
defines the name wins. A dot in a token name is a path separator
(`color.primary` is `primary` inside `color`).

A token whose resolution reaches itself again MUST give the error
`reference-cycle` (fixture `errors/reference-cycle`).

### Fallbacks

`(or a b c)` resolves to its first argument that resolves; the last argument
SHOULD be a literal:

```lino
(spaced: stack (gap (or (token space.large) (token space.medium) 8px)))
```

Fixtures: `values/`, `references/`.
