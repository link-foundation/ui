# LinksNotation for Swift

A standalone Swift implementation of the Links Notation parser and formatter.
It supports macOS 13+, iOS 16+, and Linux with Swift 5.9 or later.

```swift
.package(url: "https://github.com/link-foundation/links-notation-swift.git", from: "0.1.0"),
// In your target's dependencies:
.product(name: "LinksNotation", package: "links-notation-swift"),
```

```swift
import LinksNotation

let links = try Parser().parse("greeting: hello")
print(formatLinks(links))
```

This repository is exported from
[link-foundation/ui](https://github.com/link-foundation/ui). Report issues and
submit changes there. Run `swift test` to check the published package against
its bundled parser fixtures.
