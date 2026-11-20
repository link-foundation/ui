"""Classify the validated Git snapshot rather than a truncated API file list."""

import argparse
import os
from pathlib import Path
import subprocess


def matches(path, scopes):
    return any(scope == "." or path == scope or path.startswith(scope + "/") for scope in scopes)


def production(path):
    return not (
        path.endswith((".md", ".markdown"))
        or path.startswith((".github/", "docs/", "data/", "experiments/", "swift/ci/"))
        or Path(path).name in (".gitkeep", ".gitignore", "Dockerfile", ".dockerignore")
    )


def classify(paths, source, pipeline, standalone):
    code = any(
        matches(path, source)
        and (production(path) or (path.startswith("docs/") and "." not in source))
        for path in paths
    )
    workflows = any(path.startswith(".github/") for path in paths)
    tooling_paths = [pipeline, "experiments/test_pipeline.py", "experiments/check-embedded-swift-scope.py"]
    tooling = any(
        matches(path, tooling_paths) or Path(path).name == ".swift-format" for path in paths
    )
    doc_inputs = [path for path in paths if standalone or matches(path, [pipeline, *source])]
    return {
        "code": code,
        "swift": code or workflows or tooling,
        "docs": workflows or tooling or any(path.endswith((".md", ".markdown")) for path in doc_inputs),
        "workflows": workflows or tooling,
        "container": standalone and (code or workflows or any(path in ("Dockerfile", ".dockerignore") for path in paths)),
    }


def changed_paths(base):
    output = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", base, "HEAD"])
    return [os.fsdecode(path) for path in output.split(b"\0") if path]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("package")
    parser.add_argument("pipeline")
    parser.add_argument("source")
    parser.add_argument("mode", choices=["standalone", "embedded"])
    options = parser.parse_args()
    source = [str(Path(line.strip())) for line in options.source.splitlines() if line.strip()]
    if options.mode == "embedded" and (not source or "." in source):
        parser.error("Embedded mode needs explicit repository-relative Swift source paths.")
    if not source:
        source = [str(Path(options.package))]
    results = classify(changed_paths(options.base), source, options.pipeline, options.mode == "standalone")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        for key, value in results.items():
            assignment = f"{key}={str(value).lower()}"
            print(assignment)
            print(assignment, file=output)
    if not results["swift"]:
        print("::notice::Swift build and tests skipped because no Swift inputs changed.")


if __name__ == "__main__":
    main()
