import XCTest

@testable import LinksNotation

/// The cross-language golden corpus of `links-notation`
/// (`parity/text-fixtures.json`, copied from upstream; see
/// `docs/native-parsers.md`).
final class ParityTests: XCTestCase {
    private let corpus = packageDirectory.appendingPathComponent("parity/text-fixtures.json")

    func testCorpusHasEveryUpstreamCase() throws {
        let ids = try loadCases(corpus).map(\.id)
        XCTAssertEqual(
            ids,
            [
                "empty", "singlet", "tuple", "named", "nested", "indent", "context", "quotes",
                "empty-ref", "unicode", "comments", "quote-runs", "multiline", "literal",
            ])
    }

    func testParseFormatAndRoundTripEveryCase() throws {
        for fixture in try loadCases(corpus) {
            try assertParseFormatRoundTrip(fixture)
        }
    }
}
