"""Check the structure and line count of the template documentation."""

import argparse
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["standalone", "embedded"])
    parser.add_argument("pipeline", type=Path)
    options = parser.parse_args()
    scopes = ["."] if options.mode == "standalone" else [str(options.pipeline)]
    paths = subprocess.check_output(["git", "ls-files", "-z", "--", *scopes]).decode().split("\0")
    problems = []
    for path in map(Path, filter(None, paths)):
        if path.suffix.lower() in (".md", ".markdown"):
            if len(path.read_text(encoding="utf-8").splitlines()) > 2500:
                problems.append(f"{path} exceeds 2500 lines.")
    if options.mode == "standalone":
        sections = {
            "README.md": ("## Getting started", "## Release", "## Monorepo adoption"),
            "docs/case-studies/issue-1/README.md": ("## Requirements", "## Alternatives", "## Verification"),
        }
        for name, headings in sections.items():
            path = Path(name)
            if name != "README.md" and not path.exists():
                continue
            lines = path.read_text(encoding="utf-8").splitlines() if path.is_file() else []
            problems.extend(f"{path} needs a {heading} section." for heading in headings if heading not in lines)
    for problem in problems:
        print(f"::error::{problem}")
    return bool(problems)


if __name__ == "__main__":
    raise SystemExit(main())
