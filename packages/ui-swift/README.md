# ui-swift

The SwiftUI renderer of link-foundation/ui
([#30](https://github.com/link-foundation/ui/issues/30)). It reads a document
written in Links Notation with the Swift parser
([`native/swift/LinksNotation`](../../native/swift/LinksNotation), #29) and
draws it with native SwiftUI views.

This is a Swift package, not an npm workspace package. Its `Package.swift` is
at the repository root, so SwiftPM users add the repository URL:

```swift
.package(url: "https://github.com/link-foundation/ui", branch: "main"),
// …
.product(name: "UiSwiftUI", package: "ui"),
```

There are no package dependencies, so there is no `Package.resolved`, and no
licence other than the repository's own is involved.

| Target        | Platforms                           | What it holds                                                                                                                   |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `UiSwiftCore` | macOS 14+, iOS 17+, Linux           | Foundation only: the element tree (a port of the spec's reference projection), token resolution, actions, the render tree       |
| `UiSwiftUI`   | macOS 14+, iOS 17+                  | `UiView`, the `@Observable` `UiDocumentModel` and `Tokens.swift`, the F11 output of [`ui-tokens`](../ui-tokens/README.md) (#19) |
| `UiDemo`      | macOS 14+ (`examples/swift/UiDemo`) | A macOS app that renders [`document.lino`](../../docs/case-studies/issue-1/samples/document.lino)                               |

## Usage

```swift
import SwiftUI
import UiSwiftCore
import UiSwiftUI

let document = UiDocumentModel(lino: try String(contentsOf: url, encoding: .utf8))

struct ContentView: View {
    var body: some View {
        UiView(document: document) { action in
            // UiAction(source: "ok", event: "press", action: ["navigate", "home"])
            if action.action.first == "navigate" { router.go(to: action.action[1]) }
        }
    }
}

// Each element has its own observable model: only `greeting` is drawn again.
document.setProp(id: "greeting", name: "value", values: [.atom("Bye")])
```

The full signature is
`UiView(document: UiDocumentModel, theme: UiTheme = .default, onAction: @escaping (UiAction) -> Void = { _ in })`.

### Themes

`UiTheme.default` is the `material3` set of
[`tokens.lino`](../../docs/case-studies/issue-1/samples/tokens.lino), the same
values as the vendored `Tokens.swift`. Any other theme can be read at runtime
with the LinksNotation parser:

```swift
let theme = try UiTheme(lino: String(contentsOf: themeURL, encoding: .utf8), active: "brand")
UiView(document: document, theme: theme)
```

`(token space.medium)` is looked up in the active set, then along its
`(extends …)` chain (of two parents, the later one wins, as in ui-tokens), then
in the base theme, which is `.default` unless you pass another. `(or a b)`
takes the first value that resolves. A missing token is an `unresolved-token`
warning and the property is left out; it never crashes.

### Actions

`(on press (navigate home))` is data. Pressing the button calls `onAction`
once per action, in order, with
`UiAction(source: "ok", event: "press", action: ["navigate", "home"])`. The
renderer never evaluates a string. A handler that is not an action list, an
unknown action, and a `navigate` to a `javascript:`, `data:` or `vbscript:`
target are dropped with a diagnostic (`invalid-handler`, `unknown-action`,
`unsafe-url`), so the host never receives them.

### Accessibility

Every view has `.accessibilityIdentifier` set to its element's link id
(`ok`, `greeting`, …). Each view also has its native label: the text of a
`Text`, the label of a `Button`, `alt` of an image, and `title` of a document.
Containers keep their children as separate accessibility elements.

## Mapping

| Kind       | SwiftUI view        | Properties                                                                                                                                                |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document` | `ScrollView`        | `title` → accessibility label                                                                                                                             |
| `stack`    | `VStack` / `HStack` | `direction horizontal` → `HStack`; `gap` → `spacing`; `padding`; `align start/end` → `leading/trailing` (`top/bottom` in an `HStack`), otherwise `center` |
| `text`     | `Text`              | `value`, or the positional values                                                                                                                         |
| `button`   | `Button`            | `label` (or the positional values); `disabled true`; `on press` → `onAction`                                                                              |
| `image`    | `AsyncImage`        | `source` → `url` (only `http`/`https`-style URLs that are not unsafe); `width`, `height`; `alt` → label                                                   |
| any other  | `EmptyView`         | an `unsupported-kind` diagnostic, written to the unified log; its children are not drawn                                                                  |

Dimensions are drawn in points: `px` is 1 point, and `rem` and `em` are 16
points, as in ui-tokens' Swift output. Relative units (`%`, `vw`, `vh`) are
an `unsupported-value` diagnostic. The other properties of the vocabulary
(for example `variant` of a button) are not drawn in v0.

`renderHead` in `UiSwiftCore` decides what each element becomes. The SwiftUI
views draw exactly that `RenderNode`, so the views and the snapshot tests
cannot disagree.

### Diagnostics

The projection's diagnostics are those of the spec
([`docs/spec`](../../docs/spec)). The renderer adds these codes of its own:

| Code                                | Severity | `at`                                     | When                                                       |
| ----------------------------------- | -------- | ---------------------------------------- | ---------------------------------------------------------- |
| `unsupported-kind`                  | warning  | `element`, `kind`                        | a kind that is not in the mapping table                    |
| `unresolved-token`                  | warning  | `element`, `property`, `token`           | `(token …)` names no token of the theme                    |
| `unresolved-param`                  | warning  | `element`, `property`                    | `(param …)` outside a component (components are not drawn) |
| `unsupported-value`                 | warning  | `element`, `property`                    | a value the view cannot draw (`50%` as a gap)              |
| `unsafe-url`                        | error    | `element`, `property` (`source` or `on`) | an image source or `navigate` target that is unsafe        |
| `invalid-handler`, `unknown-action` | error    | `element`, `property: on`                | an `on` handler that is dropped                            |

`RenderTree.diagnostics` holds them all. `UiView` also writes each of them
once to the unified log (subsystem `link-foundation.ui`, category `render`)
and keeps them in `UiDiagnosticLog.shared.diagnostics`.

## Render-tree snapshots

`RenderTree.dumpLino()` writes the tree as Links Notation, one node per line,
with children indented by two spaces, so that the other ports (#32) can
produce the same text:

```
(app: ScrollView
  (body: VStack (spacing 16)
    (greeting: Text 'Hello, links')
    (ok: Button (label OK))))
```

Each line is a link written by the LinksNotation formatter, which quotes a
reference only when it has to. That is why the label is `OK` and not `'OK'`
as in the issue text, while `'Hello, links'` keeps its quotes because of the
comma and the space. Handlers and accessibility labels are not part of the
dump; the action and accessibility tests check them.

Every fixture in [`docs/spec/fixtures`](../../docs/spec/fixtures) that is not
an error fixture and uses only the five drawn kinds has a snapshot in
`Tests/Snapshots/<area>/<name>.render.lino`. `FixtureTests` fails when one is
missing, stale or different, and checks that its ids and parent/child pairs
are those of the fixture's `.tree.json`. After a wanted change, rewrite them
and review the diff:

```sh
UPDATE_SNAPSHOTS=1 swift test --filter FixtureTests
```

## Tests

```sh
swift test                         # from the repository root; on Linux, UiSwiftCore only
swift run UiDemo                   # macOS: open the demo window
swift run UiDemo --dump            # print the render tree of the sample
swift run UiDemo --appearance dark --screenshot dark.png
node --test tests/ui-swift-tokens.test.js  # the vendored Tokens.swift equals the F11 output
```

| Suite                    | Checks                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectionTests`        | the Swift projection gives the `.tree.json` / `.diagnostics.json` of every spec fixture                                                   |
| `RenderTreeTests`        | each row of the mapping table, the unknown-kind diagnostic, accessibility identifiers                                                     |
| `ThemeTests`             | `(token space.medium)` through the F11 default, a missing token is a diagnostic, runtime themes                                           |
| `ActionTests`            | pressing `ok` gives the expected `UiAction`; `javascript:` and other unsafe targets are rejected                                          |
| `FixtureTests`           | a snapshot for every renderable fixture; ids and parent/child pairs equal `.tree.json`                                                    |
| `UiSwiftUITests` (macOS) | `Tokens.swift` equals `UiTheme.default`; `setProp` invalidates one element; the hosted views' accessibility identifiers, labels and press |

The [Swift workflow](../../.github/workflows/swift.yml) runs them on Linux
and on macOS, and uploads UiDemo screenshots (light and dark) as the
`ui-swift-screenshots` artifact.

## License

[Unlicense](../../LICENSE).
