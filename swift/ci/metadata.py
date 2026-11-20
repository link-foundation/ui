"""Validate changesets and generate the only files a Swift release may modify."""

from dataclasses import dataclass
from pathlib import Path
import re
import subprocess

VERSION_FILE = Path("swift/ci/VERSION")
CHANGESETS = Path("swift/ci/changesets")
CHANGELOG = Path("CHANGELOG.md")
BUMP_TYPES = ("patch", "minor", "major")
SEMVER = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
INITIAL_VERSION = "0.0.0"


def git(*arguments):
    return subprocess.check_output(["git", *map(str, arguments)], text=True).strip()


@dataclass(frozen=True)
class Changeset:
    path: Path
    kind: str
    summary: str


def read_changesets():
    entries = []
    for path in sorted(CHANGESETS.glob("*")):
        if path.name == "README.md":
            continue
        if path.is_symlink() or not path.is_file() or not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.md", path.name):
            raise ValueError(f"{path}: use an ordinary file named like fix-description.md.")
        lines = path.read_text(encoding="utf-8").strip().splitlines()
        if len(lines) != 2 or lines[0] not in BUMP_TYPES or not lines[1].strip():
            raise ValueError(f"{path}: expected patch, minor or major on line one and a summary on line two.")
        entries.append(Changeset(path, lines[0], lines[1].strip()))
    return entries


def validate_pull_request(base, require_changeset):
    # Release metadata is generated only by the writer. Diff the checked merge
    # tree against the base so an existing main changeset never satisfies a PR.
    protected = git("diff", "--name-only", base, "HEAD", "--", VERSION_FILE, CHANGELOG)
    if protected and git("ls-tree", "--name-only", base, "--", VERSION_FILE):
        raise ValueError(f"Generated files changed: {protected}. Add a changeset instead.")
    entries = read_changesets()
    existing = set(git("ls-tree", "-r", "--name-only", base, "--", CHANGESETS).splitlines())
    if require_changeset and not any(str(entry.path) not in existing for entry in entries):
        raise ValueError(f"Add a new changeset in {CHANGESETS}/ for Swift source or package changes.")


def version():
    current = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not SEMVER.fullmatch(current):
        raise ValueError(f"{VERSION_FILE} must contain one semantic version.")
    return current


def next_version(current, entries):
    parts = [int(part) for part in current.split(".")]
    bump = min(2 - BUMP_TYPES.index(entry.kind) for entry in entries)
    parts[bump] += 1
    parts[bump + 1:] = [0] * (2 - bump)
    return ".".join(map(str, parts))


def release_notes(target, entries):
    return f"## [{target}]\n\n" + "".join(f"- {entry.summary}\n" for entry in entries)


def notes_for_tag(tag):
    changelog = git("show", f"{tag}:{CHANGELOG}")
    title = f"## [{tag.removeprefix('v')}]"
    headlines = re.split(r"(?m)^## ", changelog)
    for block in headlines[1:]:
        if block.splitlines()[0] == title.removeprefix("## "):
            return f"## {block.rstrip()}\n"
    raise ValueError(f"{tag}: generated release notes are missing from {CHANGELOG}.")


def advance(target, entries):
    original = CHANGELOG.read_text(encoding="utf-8")
    if not original.startswith("# Changelog\n\n"):
        raise ValueError("CHANGELOG.md must begin with a # Changelog heading and a blank line.")
    preface, separator, history = original.partition("\n## [")
    VERSION_FILE.write_text(target + "\n", encoding="utf-8")
    CHANGELOG.write_text(f"{preface.rstrip()}\n\n{release_notes(target, entries)}{separator}{history}", encoding="utf-8")
    for entry in entries:
        entry.path.unlink()
    paths = {str(VERSION_FILE), str(CHANGELOG), *(str(entry.path) for entry in entries)}
    git("add", "--", *sorted(paths))
    staged = set(git("diff", "--cached", "--name-only", "--no-renames").splitlines())
    if staged != paths:
        raise ValueError(f"Release commit must contain exactly its version, changelog, and consumed changesets: {staged}.")
