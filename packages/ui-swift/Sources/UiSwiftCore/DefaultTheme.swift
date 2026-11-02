// The default theme: the tokens of `Tokens.swift`, the Swift output of
// ui-tokens (#19, F11) for docs/case-studies/issue-1/samples/tokens.lino,
// which UiSwiftUI vendors as it is. UiSwiftCore is Foundation only and cannot
// import SwiftUI, so this is the same set written as token values; the
// `vendored Tokens.swift` test of tests/ui-swift.test.js and
// UiSwiftUITests.testDefaultThemeMatchesTokens keep the two equal.

extension UiTheme {
    /// The F11 default theme, `material3`.
    public static let `default` = UiTheme(
        active: "material3",
        sets: [
            TokenSet(
                id: "material3",
                extends: ["base"],
                tokens: [
                    "color.primary": .atom("#6750A4"),
                    "color.on-primary": .atom("#FFFFFF"),
                    "space.medium": .atom("16px"),
                    "shape.corner.medium": .atom("12px"),
                    "motion.duration.short": .atom("150ms"),
                ]
            )
        ]
    )
}
