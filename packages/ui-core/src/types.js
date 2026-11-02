/**
 * JSDoc types of `@link-foundation/ui-core`. This module has no runtime code.
 *
 * The node shape is exactly the element shape of
 * docs/spec/element-tree.schema.json, so `JSON.stringify` of a node equals
 * the corresponding part of a conformance fixture.
 *
 * @typedef {string | RawValue[] | { id: string, values: RawValue[] }} RawValue
 *   An atom is a string, a nested link without an id is an array, a nested
 *   link with an id is `{ id, values }`. Typed values come later (#15).
 *
 * @typedef {object} UiProperty
 * @property {string} name        `label`
 * @property {RawValue[]} values  `['OK']`
 *
 * @typedef {object} UiNode
 * @property {string|null} id            `ok`, or `null` for an anonymous element
 * @property {string|null} kind          `button`, or `null` (error `missing-kind`)
 * @property {RawValue[]} positional     atoms after the kind, in source order
 * @property {UiProperty[]} properties   in source order
 * @property {UiNode[]} children         in source order
 * @property {RawValue[]} unknown        sublinks kept verbatim (`unknown-sublink`)
 *
 * @typedef {object} DiagnosticLocation
 * @property {number} [line]             1-based, parser errors only
 * @property {number} [column]           1-based, parser errors only
 * @property {string|null} [element]     element id, `null` for anonymous or the root
 * @property {string} [kind]
 * @property {string} [property]
 * @property {string|null} [head]
 * @property {string} [token]
 *
 * @typedef {object} Diagnostic
 * @property {string} code               e.g. `duplicate-id` (docs/spec/limits.md)
 * @property {'error'|'warning'|'info'} severity
 * @property {string} message            human-readable, not part of the fixtures
 * @property {DiagnosticLocation} at
 *
 * @typedef {object} UiDocument
 * @property {string} spec               `ui-dialect/0`
 * @property {UiNode[]} roots            top-level elements in source order
 * @property {RawValue[]} unknown        top-level links that are not elements
 * @property {Map<string, UiNode>} byId  first element of every id
 * @property {Diagnostic[]} diagnostics
 *
 * @typedef {object} PropertySpec
 * @property {string|string[]} type      `dimension`, `['enum', 'a', 'b']`, ...
 * @property {boolean} multi             multi-valued (kept as a sequence)
 *
 * @typedef {object} KindSpec
 * @property {string[]} positional
 * @property {Map<string, PropertySpec>} properties
 * @property {'any'|'none'} children
 *
 * @typedef {object} Vocabulary
 * @property {string|null} version
 * @property {Map<string, KindSpec>} kinds
 * @property {Map<string, RawValue[][]>} actions
 * @property {Set<string>} multiValued
 *
 * @typedef {object} ParseOptions
 * @property {number} [maxDepth]         default `DEFAULT_MAX_DEPTH` (64)
 * @property {number} [maxInputSize]     default `DEFAULT_MAX_INPUT_SIZE` (1 MiB)
 * @property {Vocabulary} [vocabulary]   default: docs/spec/vocabulary.lino
 * @property {'auto'|'fold'|'groups'} [mode]
 *   `fold` path-folds `Parser.parse()` output; `groups` (and `auto`, the
 *   default) nests `Parser.parseGroups()` output first. Both give the same tree.
 * @property {boolean} [checks]          value and behaviour checks (default true)
 *
 * @typedef {object} FormatOptions
 * @property {'inline'|'multiline'|'indented'} [style]  default `multiline`
 * @property {string} [indent]           default two spaces
 */

export {};
