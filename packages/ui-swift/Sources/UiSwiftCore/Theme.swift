// Design tokens for the renderer: `(token space.medium)` resolves in the
// active theme, then along its `(extends ...)` chain, then in the base theme
// (docs/spec/values.md, "Resolution order"). The default theme is the F11
// output of ui-tokens (#19) for docs/case-studies/issue-1/samples/tokens.lino;
// any other theme is read at runtime from LiNo with the LinksNotation parser.

/// A theme: named token sets and the one that is active.
public struct UiTheme: Equatable, Sendable {
    /// One `(<id>: theme (extends ...) (token <name> <value>)...)` element.
    public struct TokenSet: Equatable, Sendable {
        public let id: String
        /// The sets this one extends, in the order written.
        public let extends: [String]
        /// Token name (`space.medium`) to its value as written (`16px`, `(token x)`).
        public let tokens: [String: UiValue]

        public init(id: String, extends: [String] = [], tokens: [String: UiValue]) {
            self.id = id
            self.extends = extends
            self.tokens = tokens
        }
    }

    /// The id of the active set.
    public let active: String
    public let sets: [String: TokenSet]
    /// Where a name not found along the active chain is looked up last.
    public let base: [UiTheme]

    public init(active: String, sets: [TokenSet], base: UiTheme? = nil) {
        self.active = active
        var byId: [String: TokenSet] = [:]
        for set in sets { byId[set.id] = set }
        self.sets = byId
        self.base = base.map { [$0] } ?? []
    }

    /// The theme elements of a projected document.
    /// - Parameters:
    ///   - active: the set to use; by default the first theme of the document.
    ///   - base: where names the document does not define are looked up.
    /// - Throws: `UiThemeError` when the document has an error diagnostic or no theme.
    public init(document: UiDocument, active: String? = nil, base: UiTheme? = .default) throws {
        if let error = document.diagnostics.first(where: { $0.severity == .error }) {
            throw UiThemeError.diagnostic(error)
        }
        var sets: [TokenSet] = []
        for element in document.elements where element.kind == "theme" {
            guard let id = element.id else { continue }
            var tokens: [String: UiValue] = [:]
            for property in element.properties(named: "token") {
                guard property.values.count == 2, let name = property.values[0].atom else { continue }
                tokens[name] = property.values[1]
            }
            let extends = element.properties(named: "extends").flatMap(\.values).compactMap(\.atom)
            sets.append(TokenSet(id: id, extends: extends, tokens: tokens))
        }
        guard let first = sets.first else { throw UiThemeError.noTheme }
        let chosen = active ?? first.id
        guard sets.contains(where: { $0.id == chosen }) else { throw UiThemeError.unknownTheme(chosen) }
        self.init(active: chosen, sets: sets, base: base)
    }

    /// Read a theme `.lino` file's text at runtime (parsed with LinksNotation).
    public init(lino text: String, active: String? = nil, base: UiTheme? = .default) throws {
        try self.init(document: project(text), active: active, base: base)
    }

    /// The value a token name has, as written, or `nil`.
    public func lookup(_ name: String) -> UiValue? {
        var seen = Set<String>()
        func find(_ id: String) -> UiValue? {
            guard !seen.contains(id), let set = sets[id] else { return nil }
            seen.insert(id)
            if let value = set.tokens[name] { return value }
            // Of two parents the later one wins, as in ui-tokens.
            for parent in set.extends.reversed() {
                if let value = find(parent) { return value }
            }
            return nil
        }
        return find(active) ?? base.lazy.compactMap { $0.lookup(name) }.first
    }

    /// Resolve a property value: `(token ...)` and `(or ...)` are replaced by
    /// what they refer to; a literal is returned as it is.
    ///
    /// A missing token gives `unresolved-token` (a warning, never a crash)
    /// and a token that reaches itself gives `reference-cycle`; both return `nil`.
    public func resolve(_ value: UiValue, element: String?, property: String) -> UiResolution {
        var diagnostics: [UiDiagnostic] = []
        func at(_ token: String?) -> [String: UiDiagnosticValue] {
            ["element": UiDiagnosticValue(element), "property": .string(property), "token": UiDiagnosticValue(token)]
        }
        func walk(_ value: UiValue, _ visiting: [String]) -> UiValue? {
            guard case .list(let items) = value, let head = items.first?.atom else { return value }
            switch head {
            case "token":
                guard items.count == 2, let name = items[1].atom else {
                    diagnostics.append(UiDiagnostic(code: "unresolved-token", severity: .warning, at: at(nil)))
                    return nil
                }
                if visiting.contains(name) {
                    diagnostics.append(UiDiagnostic(code: "reference-cycle", severity: .error, at: at(name)))
                    return nil
                }
                guard let found = lookup(name) else {
                    diagnostics.append(UiDiagnostic(code: "unresolved-token", severity: .warning, at: at(name)))
                    return nil
                }
                return walk(found, visiting + [name])
            case "or":
                var failed: [UiDiagnostic] = []
                for option in items.dropFirst() {
                    let before = diagnostics.count
                    if let resolved = walk(option, visiting) {
                        diagnostics.removeSubrange(before...)
                        return resolved
                    }
                    failed += diagnostics[before...]
                    diagnostics.removeSubrange(before...)
                }
                diagnostics += failed
                return nil
            case "param":
                // Component parameters are bound by components, which v0 does not render.
                diagnostics.append(UiDiagnostic(
                    code: "unresolved-param", severity: .warning,
                    at: ["element": UiDiagnosticValue(element), "property": .string(property)]))
                return nil
            default:
                return value
            }
        }
        let resolved = walk(value, [])
        return UiResolution(value: resolved, diagnostics: diagnostics)
    }
}

/// What `UiTheme.resolve` gives: the value, or `nil` and why.
public struct UiResolution: Equatable, Sendable {
    public let value: UiValue?
    public let diagnostics: [UiDiagnostic]
}

/// Why a theme document cannot be used.
public enum UiThemeError: Error, Equatable {
    case diagnostic(UiDiagnostic)
    case noTheme
    case unknownTheme(String)
}

// MARK: - Typed values

/// The points a dimension gives (`16px` is 16, `1rem` is 16, as in
/// ui-tokens' Swift export); `nil` for a relative unit (`%`, `vw`, `vh`).
public func uiPoints(_ text: String) -> Double? {
    if text == "0" { return 0 }
    guard isUiDimension(text) else { return nil }
    for (unit, scale) in [("px", 1.0), ("rem", 16.0), ("em", 16.0)] where text.hasSuffix(unit) {
        return Double(text.dropLast(unit.count)).map { $0 * scale }
    }
    return nil
}

/// The seconds a duration gives (`150ms` is 0.15).
public func uiSeconds(_ text: String) -> Double? {
    guard isUiDuration(text) else { return nil }
    if text.hasSuffix("ms") { return Double(text.dropLast(2)).map { $0 / 1000 } }
    return Double(text.dropLast())
}

/// An sRGB colour with channels from 0 to 1.
public struct UiColor: Equatable, Sendable {
    public let red: Double
    public let green: Double
    public let blue: Double
    public let opacity: Double

    public init(red: Double, green: Double, blue: Double, opacity: Double = 1) {
        self.red = red
        self.green = green
        self.blue = blue
        self.opacity = opacity
    }

    /// `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`.
    public init?(hex text: String) {
        guard isUiHexColor(text) else { return nil }
        var digits = Array(text.dropFirst())
        if digits.count <= 4 { digits = digits.flatMap { [$0, $0] } }
        if digits.count == 6 { digits += ["f", "f"] }
        let channels = stride(from: 0, to: 8, by: 2).map {
            Double(Int(String(digits[$0...$0 + 1]), radix: 16) ?? 0) / 255
        }
        self.init(red: channels[0], green: channels[1], blue: channels[2], opacity: channels[3])
    }
}

/// A number as the render tree writes it: `16`, not `16.0`.
public func uiNumberText(_ number: Double) -> String {
    if number.rounded() == number, abs(number) < 1e15 { return String(Int(number)) }
    return String(number)
}
