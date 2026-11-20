#!/usr/bin/env python3
"""Apply the same formatting and size policy on CI and staged Swift files."""

import argparse
import os
from pathlib import Path
import subprocess
import tempfile

SOURCE_LIMIT = 1500
# UI checks these files against the canonical vocabulary and token exporter.
GENERATED_SWIFT = {
    Path("packages/ui-swift/Sources/UiSwiftCore/VocabularyText.swift"),
    Path("packages/ui-swift/Sources/UiSwiftUI/Tokens.swift"),
}


def git(*arguments):
    return subprocess.check_output(["git", *arguments])


def swift_files(paths, staged):
    arguments = ["diff", "--cached", "--name-only", "--diff-filter=ACMR"] if staged else ["ls-files"]
    files = git(*arguments, "-z", "--", *paths).split(b"\0")
    return [Path(os.fsdecode(file)) for file in files if file.endswith(b".swift")]


def check_size(path, content):
    if len(content.splitlines()) > SOURCE_LIMIT:
        print(f"{path} exceeds {SOURCE_LIMIT} lines. Split it into smaller files.", flush=True)
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", default=["."])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--staged", action="store_true")
    mode.add_argument("--format", action="store_true")
    options = parser.parse_args()

    files = swift_files(options.paths, options.staged)
    if not files:
        print("No Swift files in scope.")
        return 0
    swift_format = ["swift", "format"]
    sources = [file for file in files if file not in GENERATED_SWIFT]
    if options.format:
        if not sources:
            return 0
        return subprocess.call([*swift_format, "format", "--in-place", "--", *sources])

    valid = True
    for file in files:
        content = git("show", f":{file}") if options.staged else file.read_bytes()
        valid = check_size(file, content) and valid
    if not valid:
        return 1
    if not sources:
        return 0
    if not options.staged:
        return subprocess.call([*swift_format, "lint", "--strict", "--", *sources])

    # Use the staged source and formatter config even for a partial commit.
    with tempfile.TemporaryDirectory() as temporary:
        index = set(git("ls-files", "-z").split(b"\0"))
        for file in sources:
            for ancestor in [file, *(parent / ".swift-format" for parent in file.parents)]:
                if os.fsencode(ancestor) in index:
                    target = Path(temporary, ancestor)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(git("show", f":{ancestor}"))
        return subprocess.call([*swift_format, "lint", "--strict", "--", *sources], cwd=temporary)


if __name__ == "__main__":
    raise SystemExit(main())
