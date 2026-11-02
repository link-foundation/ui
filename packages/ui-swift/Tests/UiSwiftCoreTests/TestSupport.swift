// Shared helpers of the UiSwiftCore tests: the repository paths, the spec
// fixtures and a small JSON value for comparing trees with `.tree.json`.

import Foundation
import XCTest

@testable import UiSwiftCore

/// The repository root, found from this file (packages/ui-swift/Tests/UiSwiftCoreTests/).
let repositoryRoot: URL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent()
    .deletingLastPathComponent().deletingLastPathComponent()
    .deletingLastPathComponent()

let fixturesDirectory = repositoryRoot.appendingPathComponent("docs/spec/fixtures")
let snapshotsDirectory = repositoryRoot.appendingPathComponent("packages/ui-swift/Tests/Snapshots")

func readText(_ url: URL) throws -> String {
    try String(contentsOf: url, encoding: .utf8)
}

/// One spec fixture: `docs/spec/fixtures/<area>/<name>.lino`.
struct Fixture {
    let area: String
    let name: String

    var url: URL { fixturesDirectory.appendingPathComponent(area).appendingPathComponent(name + ".lino") }
    var expectedURL: URL {
        fixturesDirectory.appendingPathComponent(area)
            .appendingPathComponent(name + (area == "errors" ? ".diagnostics.json" : ".tree.json"))
    }
    var snapshotURL: URL {
        snapshotsDirectory.appendingPathComponent(area).appendingPathComponent(name + ".render.lino")
    }
    var label: String { "\(area)/\(name)" }
}

/// Every fixture, sorted by area and name.
func allFixtures() throws -> [Fixture] {
    let manager = FileManager.default
    var fixtures: [Fixture] = []
    for area in try manager.contentsOfDirectory(atPath: fixturesDirectory.path).sorted() {
        let directory = fixturesDirectory.appendingPathComponent(area)
        var isDirectory: ObjCBool = false
        guard manager.fileExists(atPath: directory.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            continue
        }
        for file in try manager.contentsOfDirectory(atPath: directory.path).sorted() where file.hasSuffix(".lino") {
            fixtures.append(Fixture(area: area, name: String(file.dropLast(".lino".count))))
        }
    }
    return fixtures
}

/// A JSON value, compared structurally (object key order does not matter).
indirect enum JSON: Equatable, CustomStringConvertible {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([JSON])
    case object([String: JSON])

    init(any: Any) {
        switch any {
        case let text as String: self = .string(text)
        case let number as NSNumber:
            #if canImport(Darwin)
                if CFGetTypeID(number) == CFBooleanGetTypeID() {
                    self = .bool(number.boolValue)
                    return
                }
            #endif
            self = .number(number.doubleValue)
        case let array as [Any]: self = .array(array.map(JSON.init(any:)))
        case let object as [String: Any]: self = .object(object.mapValues(JSON.init(any:)))
        default: self = .null
        }
    }

    init(file url: URL) throws {
        self.init(any: try JSONSerialization.jsonObject(with: Data(contentsOf: url), options: [.fragmentsAllowed]))
    }

    subscript(key: String) -> JSON? {
        if case .object(let object) = self { return object[key] }
        return nil
    }

    var array: [JSON]? {
        if case .array(let items) = self { return items }
        return nil
    }

    var string: String? {
        if case .string(let text) = self { return text }
        return nil
    }

    var description: String {
        switch self {
        case .string(let text): return "\"\(text)\""
        case .number(let number): return String(number)
        case .bool(let value): return String(value)
        case .null: return "null"
        case .array(let items): return "[" + items.map(\.description).joined(separator: ",") + "]"
        case .object(let object):
            return "{" + object.keys.sorted().map { "\"\($0)\":\(object[$0]!)" }.joined(separator: ",") + "}"
        }
    }
}

extension JSON {
    init(_ value: UiValue) {
        switch value {
        case .atom(let text): self = .string(text)
        case .list(let values): self = .array(values.map(JSON.init))
        case .link(let id, let values): self = .object(["id": .string(id), "values": .array(values.map(JSON.init))])
        }
    }

    init(_ node: UiNode) {
        self = .object([
            "id": node.id.map(JSON.string) ?? .null,
            "kind": node.kind.map(JSON.string) ?? .null,
            "positional": .array(node.positional.map(JSON.string)),
            "properties": .array(node.properties.map {
                .object(["name": .string($0.name), "values": .array($0.values.map(JSON.init))])
            }),
            "children": .array(node.children.map(JSON.init)),
            "unknown": .array(node.unknown.map(JSON.init)),
        ])
    }

    init(_ diagnostic: UiDiagnostic) {
        self = .object([
            "code": .string(diagnostic.code),
            "severity": .string(diagnostic.severity.rawValue),
            "at": .object(diagnostic.at.mapValues {
                switch $0 {
                case .string(let text): return .string(text)
                case .number(let number): return .number(Double(number))
                case .null: return .null
                }
            }),
        ])
    }

    /// The tree JSON of docs/spec/element-tree.schema.json, with the
    /// diagnostics sorted (their order is not significant).
    init(tree document: UiDocument) {
        var object: [String: JSON] = [
            "spec": .string(uiSpecVersion),
            "elements": .array(document.elements.map(JSON.init)),
            "diagnostics": JSON.sortedDiagnostics(document.diagnostics.map(JSON.init)),
        ]
        if !document.unknown.isEmpty {
            object["unknown"] = .array(document.unknown.map(JSON.init))
        }
        self = .object(object)
    }

    static func sortedDiagnostics(_ diagnostics: [JSON]) -> JSON {
        .array(diagnostics.sorted { $0.description < $1.description })
    }

    /// The same JSON with its `diagnostics` sorted.
    var normalized: JSON {
        guard case .object(var object) = self, let diagnostics = object["diagnostics"]?.array else { return self }
        object["diagnostics"] = JSON.sortedDiagnostics(diagnostics)
        return .object(object)
    }
}
