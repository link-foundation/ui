// The value checks that need the vocabulary types (docs/spec/values.md and
// behaviour.md) and the token cycle check (docs/spec/references.md), ported
// from scripts/spec-reference-projection.mjs. A `.list` is a JSON array, a
// `.link` a JSON object and an `.atom` a JSON string, as in values.md.

import Foundation

/// The schemes `navigate` must never open (behaviour.md): matched without
/// case after leading white space.
public func isUnsafeNavigationTarget(_ target: String) -> Bool {
    let trimmed = target.drop(while: { $0.isWhitespace })
    guard let colon = trimmed.firstIndex(of: ":") else { return false }
    return ["javascript", "data", "vbscript"].contains(trimmed[..<colon].lowercased())
}

private func matches(_ pattern: String, _ text: String) -> Bool {
    text.range(of: pattern, options: .regularExpression) != nil
}

private let numberPattern = #"^-?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$"#
private let dimensionPattern = #"^-?(\d+(\.\d+)?|\.\d+)(px|rem|em|%|vw|vh)$"#
private let durationPattern = #"^(\d+(\.\d+)?|\.\d+)(ms|s)$"#
private let hexColorPattern = #"^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"#
private let tokenNamePattern = #"^[a-z0-9-]+(\.[a-z0-9-]+)*$"#

/// Whether `text` is a number of values.md (`16`, `-0.5`, `1e3`).
public func isUiNumber(_ text: String) -> Bool { matches(numberPattern, text) }
/// Whether `text` is a dimension of values.md (`16px`, `1.5rem`, `0`).
public func isUiDimension(_ text: String) -> Bool { matches(dimensionPattern, text) || text == "0" }
/// Whether `text` is a duration of values.md (`150ms`, `0.2s`).
public func isUiDuration(_ text: String) -> Bool { matches(durationPattern, text) }
/// Whether `text` is a hex colour of values.md (`#6750A4`).
public func isUiHexColor(_ text: String) -> Bool { matches(hexColorPattern, text) }

private func stringMatches(_ type: String, _ value: String) -> Bool {
    switch type {
    case "number": return isUiNumber(value)
    case "dimension": return isUiDimension(value)
    case "duration": return isUiDuration(value)
    case "color": return isUiHexColor(value)
    case "url": return matches(#"^(https?:|mailto:|/|\.)"#, value) || !value.contains(":")
    case "token-name": return matches(tokenNamePattern, value)
    case "boolean": return value == "true" || value == "false"
    // A URL when it has a `:` or a `/`, otherwise an element id.
    case "element-ref-or-url":
        return !(value.contains(":") || value.contains("/")) || stringMatches("url", value)
    default: return true
    }
}

private func isTypedReference(_ value: UiValue) -> Bool {
    guard case .list(let items) = value, let head = items.first?.atom else { return false }
    return ["token", "param", "or"].contains(head)
}

private func isFunctionalColor(_ items: [UiValue]) -> Bool {
    guard let space = items.first?.atom, ["oklch", "rgb"].contains(space) else { return false }
    let channels = items.dropFirst()
    return [3, 4].contains(channels.count) && channels.allSatisfy { channel in
        guard var text = channel.atom else { return false }
        if text.hasSuffix("%") { text.removeLast() }
        return isUiNumber(text)
    }
}

/// Whether a value fits a vocabulary type (values.md).
public func valueMatches(_ type: UiValue, _ value: UiValue) -> Bool {
    if let text = value.atom, text.hasPrefix("@") || text.hasPrefix("$") {
        return true  // already reported as reserved-sigil
    }
    if isTypedReference(value), case .list(let items) = value {
        if items[0].atom == "or" {
            return items.dropFirst().allSatisfy { valueMatches(type, $0) }
        }
        return items.count == 2 && items[1].atom != nil
    }
    if case .list(let declaration) = type {
        return declaration.first?.atom == "enum" && value.atom != nil && declaration.dropFirst().contains(value)
    }
    let typeName = type.atom ?? ""
    guard let text = value.atom else {
        if typeName == "color", case .list(let items) = value {
            return isFunctionalColor(items)
        }
        return typeName == "any" || typeName == "action"
    }
    return stringMatches(typeName, text)
}

/// `invalid-value`, `unexpected-child` and the handler checks for a projected tree.
func checkValues(_ document: UiDocument, _ vocabulary: UiVocabulary) -> [UiDiagnostic] {
    var diagnostics: [UiDiagnostic] = []
    func visit(_ element: UiNode) {
        let spec = element.kind.flatMap { vocabulary.kinds[$0] }
        for property in element.properties {
            let at: [String: UiDiagnosticValue] = ["element": UiDiagnosticValue(element.id), "property": .string(property.name)]
            guard let type = spec?.properties[property.name]?.type else { continue }
            if type == .atom("action") {
                diagnostics += handlerDiagnostics(property.values, vocabulary).map {
                    UiDiagnostic(code: $0.code, severity: $0.severity, at: at)
                }
                continue
            }
            if type == .atom("any") || type == .atom("string") { continue }
            for value in property.values where !valueMatches(type, value) {
                diagnostics.append(UiDiagnostic(code: "invalid-value", severity: .error, at: at))
            }
        }
        if let spec, spec.children == .atom("none"), !element.children.isEmpty {
            diagnostics.append(UiDiagnostic(code: "unexpected-child", severity: .warning, at: ["element": UiDiagnosticValue(element.id)]))
        }
        element.children.forEach(visit)
    }
    document.elements.forEach(visit)
    return diagnostics
}

/// The text JavaScript's `String(value)` gives for a value.
private func jsString(_ value: UiValue) -> String {
    switch value {
    case .atom(let text): return text
    case .list(let items): return items.map(jsString).joined(separator: ",")
    case .link: return "[object Object]"
    }
}

/// The diagnostics of one `(on <event> <action>...)` handler, without `at`:
/// actions are data, never code (behaviour.md).
func handlerDiagnostics(_ values: [UiValue], _ vocabulary: UiVocabulary) -> [UiDiagnostic] {
    guard let event = values.first, event.atom != nil, values.count > 1 else {
        return [UiDiagnostic(code: "invalid-handler", severity: .error)]
    }
    var diagnostics: [UiDiagnostic] = []
    for action in values.dropFirst() {
        guard case .list(let items) = action else {
            diagnostics.append(UiDiagnostic(code: "invalid-handler", severity: .error))
            continue
        }
        guard let head = items.first?.atom, vocabulary.actions[head] != nil else {
            diagnostics.append(UiDiagnostic(code: "unknown-action", severity: .warning))
            continue
        }
        if head == "navigate", isUnsafeNavigationTarget(items.count > 1 ? jsString(items[1]) : "") {
            diagnostics.append(UiDiagnostic(code: "unsafe-url", severity: .error))
        }
    }
    return diagnostics
}

/// `reference-cycle`: token values that refer to each other along a theme chain.
func checkTokenCycles(_ document: UiDocument) -> [UiDiagnostic] {
    struct ThemeTokens {
        var tokens: [(UiValue, UiValue?)] = []
        var base: String?

        func value(_ name: UiValue) -> UiValue?? {
            tokens.last(where: { $0.0 == name }).map(\.1)
        }
    }
    // Anonymous themes (and the id "") are never looked up, as in the reference.
    var order: [String] = []
    var themes: [String: ThemeTokens] = [:]
    for element in document.elements where element.kind == "theme" {
        guard let id = element.id, !id.isEmpty else { continue }
        var theme = ThemeTokens()
        for property in element.properties {
            if property.name == "token", let name = property.values.first {
                theme.tokens.removeAll { $0.0 == name }
                theme.tokens.append((name, property.values.count > 1 ? property.values[1] : nil))
            }
            if property.name == "extends" {
                theme.base = property.values.first?.atom
            }
        }
        if themes[id] == nil { order.append(id) }
        themes[id] = theme
    }
    func lookup(_ start: String, _ name: UiValue) -> UiValue? {
        var seen = Set<String>()
        var current: String? = start
        while let theme = current, !theme.isEmpty, let entry = themes[theme], !seen.contains(theme) {
            seen.insert(theme)
            if let found = entry.value(name) { return found }
            current = entry.base
        }
        return nil
    }
    func refs(_ value: UiValue?) -> [UiValue] {
        guard case .list(let items)? = value else { return [] }
        if items.first?.atom == "token" { return items.count > 1 ? [items[1]] : [] }
        return items.flatMap { refs($0) }
    }
    var diagnostics: [UiDiagnostic] = []
    for theme in order {
        for (name, _) in themes[theme]!.tokens {
            // Whether a walk from `current` comes back to `name`.
            func cycles(_ current: UiValue, _ visiting: Set<UiValue>) -> Bool {
                if visiting.contains(current) { return current == name }
                return refs(lookup(theme, current)).contains { cycles($0, visiting.union([current])) }
            }
            let cycle = cycles(name, [])
            if cycle {
                var at: [String: UiDiagnosticValue] = ["element": .string(theme), "property": "token"]
                at["token"] = name.atom.map(UiDiagnosticValue.string) ?? .null
                diagnostics.append(UiDiagnostic(code: "reference-cycle", severity: .error, at: at))
            }
        }
    }
    return diagnostics
}
