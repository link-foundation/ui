import XCTest

@testable import LinksNotation

/// The parser vectors of the ui-dialect/0 conformance fixtures
/// (`docs/spec/parser-vectors.json`, written by
/// `scripts/generate-parser-vectors.mjs` from the JavaScript reference).
final class SpecVectorsTests: XCTestCase {
    private let vectors = repositoryRoot.appendingPathComponent("docs/spec/parser-vectors.json")

    /// The limits of `docs/spec/limits.md`, which the vectors were made with.
    private let parser = Parser(options: ParserOptions(maxDepth: 64, maxInputSize: 1_048_576))

    func testThereAreVectorsForEveryKind() throws {
        let cases = try loadCases(vectors)
        XCTAssertGreaterThanOrEqual(cases.count, 30)
        XCTAssertTrue(cases.contains { $0.error == true && $0.code == "syntax-error" })
        XCTAssertTrue(cases.contains { $0.error == true && $0.code == "depth-exceeded" })
    }

    func testEveryValidVectorParsesFormatsAndRoundTrips() throws {
        for fixture in try loadCases(vectors) where fixture.error != true {
            try assertParseFormatRoundTrip(fixture)
        }
    }

    func testEveryErrorVectorIsRefusedWhereTheReferenceRefusesIt() throws {
        for fixture in try loadCases(vectors) where fixture.error == true {
            let line = try XCTUnwrap(fixture.line, fixture.id)
            let column = try XCTUnwrap(fixture.column, fixture.id)
            let message = try XCTUnwrap(fixture.message, fixture.id)
            let expected: ParseError
            switch fixture.code {
            case "syntax-error":
                expected = .syntax(line: line, column: column, message: message)
            case "depth-exceeded":
                expected = .depthExceeded(64)
            default:
                XCTFail("\(fixture.id): unknown error code \(fixture.code ?? "nil")")
                continue
            }

            XCTAssertThrowsError(try parser.parse(fixture.input), fixture.id) { error in
                XCTAssertEqual(error as? ParseError, expected, fixture.id)
            }
            XCTAssertThrowsError(try parser.parseLocated(fixture.input), fixture.id) { error in
                XCTAssertEqual(
                    error as? LocatedParseError,
                    LocatedParseError(error: expected, line: line, column: column), fixture.id)
            }
        }
    }
}
