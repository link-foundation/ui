#!/usr/bin/env python3
"""Exercise the Swift classifier with the source paths supplied by the caller."""

import os
from pathlib import Path
import runpy


def main():
    pipeline = os.environ["PIPELINE"]
    source_paths = os.environ["SWIFT_SOURCES"].splitlines()
    is_root = os.environ["SWIFT_PACKAGE"] == "."
    classify = runpy.run_path(Path(pipeline) / "scope.py")["classify"]
    cases = {
        "packages/ui-core/src/index.js": False,
        "kotlin/parser-tests/build.gradle.kts": False,
        "packages/ui-kotlin/build.gradle.kts": False,
        "docs/spec/parser-vectors.json": True,
        "docs/spec/fixtures/samples/document.lino": True,
        "docs/spec/limits.md": True,
        "native/swift/LinksNotation/Package.swift": True,
        "Package.swift": is_root,
        "packages/ui-swift/Sources/UiSwiftUI/UiView.swift": is_root,
        "examples/swift/UiDemo/main.swift": is_root,
        "docs/case-studies/issue-1/samples/document.lino": is_root,
    }
    for path, expected in cases.items():
        result = classify([path], source_paths, pipeline, standalone=False)
        if result["swift"] != expected or result["container"]:
            raise SystemExit(f"{path}: expected swift={expected}, container=False; got {result}")
        print(f"{path}: swift={str(expected).lower()}")


if __name__ == "__main__":
    main()
